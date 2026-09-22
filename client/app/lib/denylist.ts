import { redis } from "./redis";

/**
 * ============================================================================
 * REDIS DENYLIST KEY ARCHITECTURE & TTL DESIGN
 * ============================================================================
 *
 * 1. Single Token / JWT Revocation:
 *    Key Format: `denylist:token:<jti_or_token_hash>`
 *    Value:      JSON payload with revocation metadata (e.g. { revokedAt, reason })
 *    TTL:        Remaining TTL of the JWT token in seconds (e.g., exp - currentTime)
 *                When TTL expires, Redis automatically cleans up the key so memory remains lean!
 *
 * 2. User-wide Session Revocation (Revoke all active tokens of a user):
 *    Key Format: `denylist:user:<userId>`
 *    Value:      Revocation timestamp in milliseconds (string)
 *    TTL:        Maximum JWT token duration (e.g., 7 days = 604800 seconds)
 *                If token.iat (issued at) < revokedAt timestamp, token is rejected.
 * ============================================================================
 */

export const DENYLIST_PREFIXES = {
  TOKEN: "denylist:token:",
  USER: "denylist:user:",
};

export interface RevokeTokenOptions {
  jtiOrToken: string;
  expiresInSeconds?: number; // TTL in seconds
  reason?: string;
}

export const DenylistService = {
  /**
   * Generates Redis key for token denylist
   */
  getTokenKey(jtiOrToken: string): string {
    return `${DENYLIST_PREFIXES.TOKEN}${jtiOrToken}`;
  },

  /**
   * Generates Redis key for user global denylist
   */
  getUserKey(userId: string): string {
    return `${DENYLIST_PREFIXES.USER}${userId}`;
  },

  /**
   * Revokes a specific JWT / Token by adding its JTI/hash to Redis Denylist with TTL
   */
  async revokeToken({ jtiOrToken, expiresInSeconds = 86400, reason = "logout" }: RevokeTokenOptions): Promise<boolean> {
    if (!jtiOrToken || expiresInSeconds <= 0) return false;

    const key = this.getTokenKey(jtiOrToken);
    const value = JSON.stringify({
      revokedAt: Date.now(),
      reason,
    });

    // Set key in Redis with EX (TTL in seconds)
    await redis.set(key, value, "EX", expiresInSeconds);
    return true;
  },

  /**
   * Checks if a token is present in the Redis Denylist
   */
  async isTokenRevoked(jtiOrToken: string): Promise<boolean> {
    if (!jtiOrToken) return false;
    const key = this.getTokenKey(jtiOrToken);
    const exists = await redis.exists(key);
    return exists === 1;
  },

  /**
   * Gets remaining TTL (seconds) of a revoked token key in Redis
   */
  async getTokenTTL(jtiOrToken: string): Promise<number> {
    if (!jtiOrToken) return -2;
    const key = this.getTokenKey(jtiOrToken);
    return await redis.ttl(key);
  },

  /**
   * Revokes ALL active sessions for a specific user (e.g. on security incident or password change)
   */
  async revokeUserSessions(userId: string, maxTokenAgeSeconds: number = 7 * 86400): Promise<boolean> {
    if (!userId) return false;
    const key = this.getUserKey(userId);
    const revokedAtMs = Date.now().toString();
    await redis.set(key, revokedAtMs, "EX", maxTokenAgeSeconds);
    return true;
  },

  /**
   * Checks if a user's sessions issued before revocation are invalidated
   */
  async isUserSessionRevoked(userId: string, tokenIssuedAtMs?: number): Promise<boolean> {
    if (!userId) return false;
    const key = this.getUserKey(userId);
    const revokedAtMsStr = await redis.get(key);
    if (!revokedAtMsStr) return false;

    if (tokenIssuedAtMs) {
      const revokedAtMs = parseInt(revokedAtMsStr, 10);
      return tokenIssuedAtMs < revokedAtMs;
    }
    return true;
  }
};
