import { getServerSession } from "next-auth";
import { authOptions } from "@/server/lib/github";
import { db } from "@/server/db";
import { deployments } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { redis, redisSubscriber } from "@/app/lib/redis";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await props.params;
  const deploymentId = params.id;

  // Build/runtime logs can contain leaked secrets (e.g. a user's own
  // Dockerfile running `RUN env`), so this stream must be scoped to the
  // deployment's owner — it was previously open to anyone who knew or
  // guessed a deployment UUID.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
    with: { project: true },
  });

  if (!deployment || deployment.project.ownerId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const channel = `logs:${deploymentId}`;
  const bufferKey = `logs:${deploymentId}:buffer`;

  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      const sub = redisSubscriber.duplicate();
      await sub.subscribe(channel);

      const messageHandler = (ch: string, message: string) => {
        if (ch === channel) {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        }
      };

      sub.on("message", messageHandler);

      controller.enqueue(encoder.encode(": connected\n\n"));
      try {
        const buffered = await redis.lrange(bufferKey, 0, -1);
        for (const message of buffered) {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        }
      } catch (err) {
        console.error("[log-stream] buffer replay failed:", err);
      }

      request.signal.addEventListener("abort", () => {
        sub.removeListener("message", messageHandler);
        sub.unsubscribe(channel);
        sub.quit();
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
      });
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells Nginx not to buffer this response; without it, a reverse proxy
      // can hold the whole (never-ending) stream and the client never sees
      // any log lines until the connection is torn down.
      "X-Accel-Buffering": "no",
    },
  });
}
