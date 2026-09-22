import { TRPCError } from "@trpc/server";
import { middleware } from "..";
import { checkRateLimit } from "@/server/lib/rateLimit";

/**
 * Per-user rate limit for a specific mutation. Must run after `isAuthed` (it
 * needs `ctx.session.user.id`) — applied per-procedure rather than
 * globally, since "deploy" and "delete account" warrant very different
 * limits, and most read-only queries need none at all.
 */
export function rateLimited(name: string, limit: number, windowSeconds: number) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user?.id) {
      // isAuthed should already have rejected this — fail closed rather
      // than rate-limiting by a shared/empty key if middleware order is
      // ever changed.
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const allowed = await checkRateLimit(`${name}:${ctx.session.user.id}`, limit, windowSeconds);
    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many requests. Please wait a moment before trying again.`,
      });
    }

    return next();
  });
}
