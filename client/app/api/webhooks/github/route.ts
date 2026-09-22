import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/server/lib/githubApi";
import { queueDeployment } from "@/server/lib/deploy";
import { decryptSecret } from "@/server/lib/crypto";
import { checkRateLimit } from "@/server/lib/rateLimit";

interface GithubPushEvent {
  ref: string;
  after: string;
  head_commit: {
    message: string;
  } | null;
  pusher: {
    name: string;
  };
  sender: {
    avatar_url: string;
  };
  repository: {
    full_name: string;
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const repoFullName = JSON.parse(rawBody || "{}")?.repository?.full_name as
    | string
    | undefined;

  if (!repoFullName) {
    return new Response("Missing repository in payload", { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.repoFullName, repoFullName),
  });

  if (!project || !project.webhookSecretEncrypted) {
    return new Response("Unknown repository", { status: 404 });
  }

  // Per-project throttle: a compromised/leaked webhook secret (or a replayed
  // valid request, which nothing here currently deduplicates) could
  // otherwise be used to spam deploys indefinitely. This runs even before
  // signature verification so it also bounds the cost of repeated bad-
  // signature attempts against one project's endpoint.
  const withinLimit = await checkRateLimit(`webhook:github:${project.id}`, 30, 60);
  if (!withinLimit) {
    return new Response("Too many requests", { status: 429 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = decryptSecret(project.webhookSecretEncrypted);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (event === "ping") {
    return new Response("pong", { status: 200 });
  }

  if (event !== "push") {
    return new Response("Ignored event", { status: 202 });
  }

  if (!project.isActive) {
    return new Response("Project is not active", { status: 202 });
  }

  const payload = JSON.parse(rawBody) as GithubPushEvent;
  const branch = payload.ref.replace("refs/heads/", "");

  if (branch !== project.defaultBranch) {
    return new Response("Ignored branch", { status: 202 });
  }

  await queueDeployment(project, {
    branch,
    commitSha: payload.after,
    commitMessage: payload.head_commit?.message,
    authorName: payload.pusher?.name,
    authorAvatarUrl: payload.sender?.avatar_url,
    triggerType: "push",
  });

  return new Response("Deployment queued", { status: 202 });
}
