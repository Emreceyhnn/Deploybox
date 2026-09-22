import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../trpc/procedures";
import { rateLimited } from "../trpc/middleware/rateLimit";
import { db } from "../db";
import { users } from "../db/schema";
import { DenylistService } from "@/app/lib/denylist";

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return user;
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const jti = ctx.session.jti;

    if (jti) {
      // Revoke for the remainder of the JWT's max lifetime so a stolen/cached
      // cookie can't be replayed after the user has explicitly signed out.
      await DenylistService.revokeToken({
        jtiOrToken: jti,
        expiresInSeconds: 30 * 24 * 60 * 60,
        reason: "logout",
      });
    }

    return { success: true };
  }),

  // Deletes the account and, via ON DELETE CASCADE on projects/deployments/
  // env_variables, every project and deployment record owned by the user.
  // Does not touch already-running containers or the GitHub webhook it
  // created — those are cleaned up by the existing per-project delete flow,
  // which the user is expected to have used first; this is a last-resort
  // "get my data out" action, not a full infra teardown.
  deleteAccount: protectedProcedure
    .use(rateLimited("auth.deleteAccount", 5, 60))
    .mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const jti = ctx.session.jti;

    await db.delete(users).where(eq(users.id, userId));

    if (jti) {
      await DenylistService.revokeToken({
        jtiOrToken: jti,
        expiresInSeconds: 30 * 24 * 60 * 60,
        reason: "account_deleted",
      });
    }

    return { success: true };
  }),

  /* ------------------------------ DENYLIST API ------------------------------ */
  // Debug/self-service tools for the (auth-protected) playground page.
  // These only ever act on the caller's own session/user — never an arbitrary
  // jti or userId supplied by the client — to prevent one user from revoking
  // another user's session.

  revokeToken: protectedProcedure
    .input(
      z.object({
        expiresInSeconds: z.number().optional().default(3600), // Default 1 hour TTL
        reason: z.string().optional().default("logout"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const jti = ctx.session.jti;
      if (!jti) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session has no jti" });
      }

      await DenylistService.revokeToken({
        jtiOrToken: jti,
        expiresInSeconds: input.expiresInSeconds,
        reason: input.reason,
      });

      const ttl = await DenylistService.getTokenTTL(jti);

      return {
        success: true,
        key: DenylistService.getTokenKey(jti),
        ttl,
        reason: input.reason,
      };
    }),

  checkTokenRevoked: protectedProcedure.query(async ({ ctx }) => {
    const jti = ctx.session.jti;
    if (!jti) {
      return { jtiOrToken: null, isRevoked: false, ttl: -2, key: null };
    }

    const isRevoked = await DenylistService.isTokenRevoked(jti);
    const ttl = await DenylistService.getTokenTTL(jti);

    return {
      jtiOrToken: jti,
      isRevoked,
      ttl,
      key: DenylistService.getTokenKey(jti),
    };
  }),

  revokeUserSessions: protectedProcedure
    .input(
      z.object({
        maxAgeSeconds: z.number().optional().default(7 * 86400),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await DenylistService.revokeUserSessions(userId, input.maxAgeSeconds);

      return {
        success: true,
        userId,
        key: DenylistService.getUserKey(userId),
      };
    }),

  checkUserRevoked: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const isRevoked = await DenylistService.isUserSessionRevoked(userId);

    return {
      userId,
      isRevoked,
      key: DenylistService.getUserKey(userId),
    };
  }),
});

