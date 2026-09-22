import { redis } from "@/app/lib/redis";

/**
 * A simple fixed-window counter backed by Redis: INCR the key for this
 * window, set an expiry on the first hit, and reject once the count exceeds
 * the limit. Not as smooth as a sliding-window/token-bucket, but it's O(1)
 * per check, requires no extra state, and is more than sufficient to stop
 * the realistic abuse case here — a script looping an expensive mutation
 * (deploy trigger, project creation, webhook spam) — rather than precisely
 * shaping traffic.
 *
 * @returns true if the request is allowed, false if the limit was exceeded.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);

  if (count === 1) {
    // Only set the TTL on the first request in this window — otherwise
    // every subsequent INCR would keep pushing the expiry back and the
    // window would never actually close.
    await redis.expire(redisKey, windowSeconds);
  }

  return count <= limit;
}
