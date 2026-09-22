import { test as base, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

const JWT_SECRET = process.env.JWT_SECRET;
const IS_SECURE_URL = (process.env.NEXTAUTH_URL || "http://localhost:3000").startsWith("https://");
const COOKIE_NAME = IS_SECURE_URL ? "__Secure-next-auth.session-token" : "next-auth.session-token";

export const TEST_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "E2E Test User",
  email: "e2e-test-user@example.com",
};

/**
 * Mints a real NextAuth JWT session cookie so tests can reach protected
 * tRPC procedures without going through GitHub OAuth.
 */
export async function signInAsTestUser(context: BrowserContext) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET must be set in the environment running Playwright.");
  }

  const token = await encode({
    secret: JWT_SECRET,
    maxAge: 30 * 24 * 60 * 60,
    token: {
      userId: TEST_USER.id,
      sub: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
    },
  });

  const url = new URL(process.env.NEXTAUTH_URL || "http://localhost:3000");

  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: IS_SECURE_URL,
      sameSite: "Lax",
    },
  ]);
}

export const test = base.extend({
  // Every test importing from this fixture file gets an authenticated `page`
  // (and `context`) automatically, without needing to opt in explicitly.
  context: async ({ context }, use) => {
    await signInAsTestUser(context);
    await use(context);
  },
});

export { expect } from "@playwright/test";
