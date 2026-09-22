import crypto from "crypto";
import GithubProvider from "next-auth/providers/github";
import { AuthOptions, DefaultSession } from "next-auth";
import { db } from "../db";
import { users } from "../db/schema";
import { encryptSecret } from "./crypto";
import { DenylistService } from "@/app/lib/denylist";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    jti?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    jti?: string;
  }
}

// Session lifetime: how long a JWT is valid for before it must be re-issued.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
// Sliding window: re-issue (refresh) the JWT once it's this close to expiring,
// so an active user's session keeps extending instead of hard-expiring.
const SESSION_REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60; // 1 day

export const authOptions: AuthOptions = {
  secret: process.env.JWT_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: (process.env.GITHUB_SECRET_KEY || process.env.GITHUB_CLIENT_SECRET)!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/projects`;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const githubProfile = profile as {
          id: number;
          login: string;
          avatar_url: string;
        };

        const encryptedAccessToken = account.access_token
          ? encryptSecret(account.access_token)
          : "";

        const [user] = await db
          .insert(users)
          .values({
            githubId: String(githubProfile.id),
            username: githubProfile.login,
            email: token.email ?? null,
            avatarUrl: githubProfile.avatar_url ?? null,
            accessTokenEncrypted: encryptedAccessToken,
          })
          .onConflictDoUpdate({
            target: users.githubId,
            set: {
              username: githubProfile.login,
              email: token.email ?? null,
              avatarUrl: githubProfile.avatar_url ?? null,
              accessTokenEncrypted: encryptedAccessToken,
              updatedAt: new Date(),
            },
          })
          .returning({ id: users.id });

        token.userId = user.id;
        // Fresh sign-in: assign this token a unique id so it can be individually revoked later.
        token.jti = crypto.randomUUID();
        const issuedAt = Math.floor(Date.now() / 1000);
        token.iat = issuedAt;
        token.exp = issuedAt + SESSION_MAX_AGE_SECONDS;

        return token;
      }

      // Existing session being re-validated on a subsequent request.
      if (token.jti && (await DenylistService.isTokenRevoked(token.jti))) {
        // Force NextAuth to drop this session: an empty token has no userId,
        // so `session()` below will fail to resolve a valid session.
        return {};
      }

      const now = Math.floor(Date.now() / 1000);
      const exp = typeof token.exp === "number" ? token.exp : 0;

      // Sliding refresh: extend the token's lifetime while it's still being used.
      if (exp - now < SESSION_REFRESH_THRESHOLD_SECONDS) {
        token.iat = now;
        token.exp = now + SESSION_MAX_AGE_SECONDS;
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.userId) {
        // Revoked or malformed token — surface no session to the client.
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }

      if (session.user) {
        session.user.id = token.userId;
      }
      session.jti = token.jti;

      return session;
    },
  },
};

