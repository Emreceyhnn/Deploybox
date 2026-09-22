import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { router } from "../trpc";
import { protectedProcedure } from "../trpc/procedures";
import { rateLimited } from "../trpc/middleware/rateLimit";
import { db } from "../db";
import { deployments, projects, users } from "../db/schema";
import { addProjectSchema } from "../validations/projects";
import {
  createRepoWebhook,
  deleteRepoWebhook,
  generateWebhookSecret,
  getRepo,
  listUserRepos,
} from "../lib/githubApi";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { queueDeployment } from "../lib/deploy";
import {
  deleteProjectEnvVar,
  getProjectEnvVarsList,
  parseEnvVarsText,
  replaceProjectEnvVars,
  upsertProjectEnvVar,
} from "../lib/envVars";
import z from "zod";

function isPublicUrl(url: string) {
  const hostname = new URL(url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return false;
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
    return false;
  }
  return true;
}

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const projectsList = await db.query.projects.findMany({
      where: eq(projects.ownerId, ctx.session.user.id),
    });

    return projectsList;
  }),

  listWithLatestDeployment: protectedProcedure.query(async ({ ctx }) => {
    const projectsList = await db.query.projects.findMany({
      where: eq(projects.ownerId, ctx.session.user.id),
      with: {
        deployments: {
          orderBy: desc(deployments.createdAt),
          limit: 1,
        },
      },
      orderBy: desc(projects.createdAt),
    });

    return projectsList.map(({ deployments: deploymentRows, ...project }) => ({
      ...project,
      latestDeployment: deploymentRows[0] ?? null,
    }));
  }),

  listGithubRepos: protectedProcedure.query(async ({ ctx }) => {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    if (!owner) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    try {
      return await listUserRepos({ accessToken: decryptSecret(owner.accessTokenEncrypted) });
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Could not list GitHub repos: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }
  }),

  add: protectedProcedure
    // Creating a project does a GitHub API round-trip and registers a real
    // webhook — cheap for a legitimate user (a handful of projects, ever),
    // but a scripted loop could otherwise spam GitHub webhook creation and
    // burn through the DB/orchestrator queue with junk projects.
    .use(rateLimited("projects.add", 10, 60))
    .input(addProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { githubRepo, subdomain, customDomain, containerPort, envVars, isActive } =
        input;
      const { id } = ctx.session.user;

      const repoPath = new URL(githubRepo).pathname
        .split("/")
        .filter(Boolean);
      const [repoOwner, repoName] = repoPath;

      if (!repoOwner || !repoName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "githubRepo must point to a repository (owner/repo)",
        });
      }

      const owner = await db.query.users.findFirst({ where: eq(users.id, id) });

      if (!owner) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const accessToken = decryptSecret(owner.accessTokenEncrypted);

      let repoInfo: { id: string; defaultBranch: string };
      try {
        repoInfo = await getRepo({
          accessToken,
          repoOwner,
          repoName,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not look up GitHub repo: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }

      const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const webhookUrl = `${appUrl}/api/webhooks/github`;
      const webhookSecret = generateWebhookSecret();
      const isPubliclyReachable = isPublicUrl(webhookUrl);

      let webhookId: string | null = null;
      if (isPubliclyReachable) {
        try {
          const hook = await createRepoWebhook({
            accessToken,
            repoOwner,
            repoName,
            webhookUrl,
            secret: webhookSecret,
          });
          webhookId = hook.id;
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Could not create GitHub webhook: ${error instanceof Error ? error.message : "unknown error"}`,
          });
        }
      }

      try {
        const [created] = await db
          .insert(projects)
          .values({
            ownerId: id,
            repoFullName: `${repoOwner}/${repoName}`,
            repoId: repoInfo.id,
            defaultBranch: repoInfo.defaultBranch,
            subdomain,
            customDomain,
            containerPort,
            isActive,
            webhookId,
            webhookSecretEncrypted: encryptSecret(webhookSecret),
          })
          .returning();

        // Env vars pasted into the "add project" form are parsed into
        // individual encrypted rows (the envVariables table) rather than
        // stored as one unencrypted text blob — see server/lib/envVars.ts.
        if (envVars) {
          await replaceProjectEnvVars(created.id, parseEnvVarsText(envVars));
        }

        // Queue initial deployment for newly created project
        await queueDeployment(created, {
          branch: repoInfo.defaultBranch,
          commitSha: "head",
          commitMessage: "Initial project setup deployment",
          authorName: owner.username ?? "System",
          authorAvatarUrl: owner.avatarUrl ?? undefined,
          triggerType: "push",
        });

        return created;
      } catch (error) {
        // Roll back the webhook we just created if we can't persist the project.
        if (webhookId) {
          await deleteRepoWebhook({
            accessToken,
            repoOwner,
            repoName,
            webhookId,
          }).catch(() => {});
        }

        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code?: string }).code === "23505"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Subdomain is already taken",
          });
        }
        throw error;
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.ownerId, ctx.session.user.id),
        ),
      });

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return project;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, isActive } = input;
      const { id: userId } = ctx.session.user;

      const [updated] = await db
        .update(projects)
        .set({
          isActive,
        })
        .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { id: userId } = ctx.session.user;

      const [deleted] = await db
        .delete(projects)
        .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (deleted.webhookId) {
        const owner = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const [repoOwner, repoName] = deleted.repoFullName.split("/");

        if (owner && repoOwner && repoName) {
          await deleteRepoWebhook({
            accessToken: decryptSecret(owner.accessTokenEncrypted),
            repoOwner,
            repoName,
            webhookId: deleted.webhookId,
          }).catch(() => {});
        }
      }

      return { id };
    }),

  /* ---------------------------- ENVIRONMENT VARS ---------------------------- */
  // Post-creation env var management — the "add project" form only writes an
  // initial set; these let a user rotate/add/remove keys afterward without
  // recreating the project (previously not possible at all).

  listEnvVars: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await getOwnedProject(input.projectId, ctx.session.user.id);
      return getProjectEnvVarsList(input.projectId);
    }),

  setEnvVar: protectedProcedure
    .input(z.object({ projectId: z.string(), key: z.string().min(1), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedProject(input.projectId, ctx.session.user.id);
      await upsertProjectEnvVar(input.projectId, input.key, input.value);
      return { success: true };
    }),

  deleteEnvVar: protectedProcedure
    .input(z.object({ projectId: z.string(), key: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedProject(input.projectId, ctx.session.user.id);
      await deleteProjectEnvVar(input.projectId, input.key);
      return { success: true };
    }),
});

async function getOwnedProject(projectId: string, ownerId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)),
  });

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return project;
}
