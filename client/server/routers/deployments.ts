import { router } from "../trpc";
import { protectedProcedure } from "../trpc/procedures";
import { rateLimited } from "../trpc/middleware/rateLimit";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { deployments, projects } from "../db/schema";
import z from "zod";
import { addDeploymentSchema } from "../validations/deployments";
import { redis } from "../../app/lib/redis";
import { queueDeployment } from "../lib/deploy";

async function getOwnedProject(projectId: string, ownerId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)),
  });

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return project;
}

async function getOwnedDeployment(deploymentId: string, ownerId: string) {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
    with: { project: true },
  });

  if (!deployment || deployment.project.ownerId !== ownerId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return deployment;
}

export const deploymentsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await getOwnedProject(input.projectId, ctx.session.user.id);

      const deploymentsList = await db.query.deployments.findMany({
        where: eq(deployments.projectId, input.projectId),
        orderBy: desc(deployments.createdAt),
      });

      return deploymentsList;
    }),

  add: protectedProcedure
    .input(addDeploymentSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        projectId,
        branch,
        commitSha,
        triggerType,
        commitMessage,
        authorName,
        authorAvatarUrl,
        imageTag,
        containerPort,
        rollbackOfDeploymentId,
      } = input;

      const project = await getOwnedProject(projectId, ctx.session.user.id);

      const [created] = await db
        .insert(deployments)
        .values({
          projectId: project.id,
          branch,
          commitSha,
          triggerType,
          commitMessage,
          authorName,
          authorAvatarUrl,
          imageTag,
          containerPort,
          rollbackOfDeploymentId,
        })
        .returning();

      return created;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return getOwnedDeployment(input.id, ctx.session.user.id);
    }),

  /* ------------------------------- REDIS-TEST ------------------------------- */
  // Debug-only tools for the (auth-protected) playground page. Both require the
  // caller to own the target deployment, so one user can't pollute or fake
  // status for another user's live deployment/log stream.

  simulateBuildLogs: protectedProcedure
    .input(z.object({ deploymentId: z.string(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedDeployment(input.deploymentId, ctx.session.user.id);

      const channel = `logs:${input.deploymentId}`;
      await redis.publish(channel, input.message);

      return { success: true, publishedTo: channel };
    }),

  triggerOrchestratorJob: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await getOwnedDeployment(input.deploymentId, ctx.session.user.id);
      const project = deployment.project;
      const payload = {
        DeploymentId: deployment.id,
        ProjectId: project.id,
        RepoFullName: project.repoFullName,
        CommitSha: deployment.commitSha,
        CommitMessage: deployment.commitMessage ?? "",
        Branch: deployment.branch,
        AuthorName: deployment.authorName ?? "",
        AuthorAvatarUrl: deployment.authorAvatarUrl ?? "",
        ImageTag: deployment.imageTag ?? "latest",
        ContainerPort: project.containerPort,
        EnvVars: project.envVars ?? "",
        TriggerType: deployment.triggerType,
        Status: deployment.status,
        Subdomain: project.subdomain,
        QueuedAt: deployment.queuedAt.toISOString(),
        StartedAt: new Date(0).toISOString(),
        FinishedAt: new Date(0).toISOString(),
        CreatedAt: deployment.createdAt.toISOString(),
        UpdatedAt: deployment.createdAt.toISOString(),
      };

      await redis.rpush("deploy:queue", JSON.stringify(payload));

      return { success: true, payload };
    }),

  trigger: protectedProcedure
    // `deploy.ts` already has a per-project Redis lock against rapid
    // double-queuing, but that doesn't stop a single user from scripting
    // triggers across many projects to flood the orchestrator's queue —
    // limit per-user regardless of which project each call targets.
    .use(rateLimited("deployments.trigger", 20, 60))
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getOwnedProject(input.projectId, ctx.session.user.id);

      return queueDeployment(project, {
        branch: project.defaultBranch,
        commitSha: "manual",
        triggerType: "manual",
        commitMessage: "Manual deploy",
        authorName: ctx.session.user.name ?? undefined,
      });
    }),

  // Redeploys a previous successful deployment's already-built image,
  // skipping clone/build entirely — fast recovery from a bad deploy without
  // needing to revert a commit and wait for a full rebuild. Only works
  // within the orchestrator's recent-image retention window (currently the
  // last 5 builds per project); older images have been pruned from disk.
  rollback: protectedProcedure
    .use(rateLimited("deployments.rollback", 20, 60))
    .input(z.object({ deploymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await getOwnedDeployment(input.deploymentId, ctx.session.user.id);

      if (target.status !== "success") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only roll back to a deployment that succeeded.",
        });
      }

      if (!target.imageTag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This deployment has no recorded image tag and can't be rolled back to.",
        });
      }

      return queueDeployment(target.project, {
        branch: target.branch,
        commitSha: target.commitSha,
        commitMessage: `Rollback to ${target.commitMessage ?? target.commitSha.slice(0, 7)}`,
        authorName: ctx.session.user.name ?? undefined,
        triggerType: "rollback",
        imageTag: target.imageTag,
        rollbackOfDeploymentId: target.id,
      });
    }),
});

