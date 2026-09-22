import { db } from "../db";
import { deployments } from "../db/schema";
import { redis } from "../../app/lib/redis";
import type { projects } from "../db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { getProjectEnvVarsAsText } from "./envVars";

type Project = InferSelectModel<typeof projects>;

export async function queueDeployment(
  project: Project,
  input: {
    branch: string;
    commitSha: string;
    commitMessage?: string;
    authorName?: string;
    authorAvatarUrl?: string;
    triggerType: "push" | "manual" | "rollback";
    // Set for a rollback: the orchestrator skips clone/build entirely and
    // reuses this already-built image tag instead.
    imageTag?: string;
    rollbackOfDeploymentId?: string;
  },
) {
  // Single-flight lock per project: two near-simultaneous pushes/triggers for
  // the same project must not both pass the "cancel pending" + "insert new"
  // sequence concurrently, or two deployments could end up active at once.
  // A short-lived Redis lock (SET NX) serializes this critical section;
  // it's released in `finally` below.
  const lockKey = `deploy:lock:${project.id}`;
  const lockValue = crypto.randomUUID();
  const acquired = await redis.set(lockKey, lockValue, "EX", 15, "NX");

  if (!acquired) {
    throw new Error("Another deployment is already being queued for this project. Try again shortly.");
  }

  try {
    // 1. Aynı proje için kuyrukta bekleyen (queued) eski deploy'ları iptal et (deduplication)
    const pendingDeployments = await db.query.deployments.findMany({
      where: and(
        eq(deployments.projectId, project.id),
        eq(deployments.status, "queued"),
      ),
    });

    for (const dep of pendingDeployments) {
      await db
        .update(deployments)
        .set({
          status: "cancelled",
          errorMessage: "Cancelled because a newer push arrived.",
          finishedAt: new Date(),
        })
        .where(eq(deployments.id, dep.id));

      // SSE dinleyicilerine (logs:<id> Redis pub/sub kanalı) iptal bilgisini yayınla
      await redis.publish(
        `logs:${dep.id}`,
        JSON.stringify({
          DeploymentId: dep.id,
          Message: "⚠️ This operation was cancelled because a newer push/deploy arrived.",
          Type: "Error",
          Timestamp: new Date().toISOString(),
        }),
      );
    }

    // 2. Yeni deploy kaydını veritabanına ekle
    const [created] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        branch: input.branch,
        commitSha: input.commitSha,
        triggerType: input.triggerType,
        commitMessage: input.commitMessage,
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl,
        containerPort: project.containerPort,
        imageTag: input.imageTag,
        rollbackOfDeploymentId: input.rollbackOfDeploymentId,
      })
      .returning();

    // 3. Redis'te proje bazlı en son deploy ID'sini set et (Lock/Latest check)
    await redis.set(`deploy:latest:${project.id}`, created.id);

    // Env vars now live in the `envVariables` table (one encrypted row per
    // key) rather than the legacy `projects.envVars` text blob, so users can
    // edit/rotate individual keys after project creation without a redeploy
    // wiping their other settings. Read them back out as the same
    // `KEY=VALUE\n...` text the orchestrator already expects.
    const envVarsText = await getProjectEnvVarsAsText(project.id);

    const payload = {
      DeploymentId: created.id,
      ProjectId: project.id,
      RepoFullName: project.repoFullName,
      CommitSha: created.commitSha,
      CommitMessage: created.commitMessage ?? "",
      Branch: created.branch,
      AuthorName: created.authorName ?? "",
      AuthorAvatarUrl: created.authorAvatarUrl ?? "",
      ImageTag: created.imageTag ?? "latest",
      ContainerPort: project.containerPort,
      EnvVars: envVarsText,
      TriggerType: created.triggerType,
      Status: created.status,
      Subdomain: project.subdomain,
      QueuedAt: created.queuedAt.toISOString(),
      StartedAt: new Date(0).toISOString(),
      FinishedAt: new Date(0).toISOString(),
      CreatedAt: created.createdAt.toISOString(),
      UpdatedAt: created.createdAt.toISOString(),
    };

    // 4. Görevi Redis kuyruğuna push et
    await redis.rpush("deploy:queue", JSON.stringify(payload));

    return created;
  } finally {
    // Only release if we still hold it (avoid deleting a lock acquired by
    // someone else after our TTL already expired).
    const currentValue = await redis.get(lockKey);
    if (currentValue === lockValue) {
      await redis.del(lockKey);
    }
  }
}
