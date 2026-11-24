const DEFAULT_SITE_URL = "https://deploybox.emreceyhan.xyz";

/**
 * Canonical public origin, without a trailing slash.
 * The Docker build has no NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL, and pages,
 * sitemap, robots and the Open Graph image are prerendered at build time, so
 * the fallback is the production domain rather than localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
).replace(/\/+$/, "");

/** Public, indexable pages. Everything behind sign-in is excluded. */
export const PUBLIC_PAGES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
}> = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

/** Routes that need a session (or are dev-only) and must not be crawled. */
export const PRIVATE_PATHS = ["/projects", "/playground", "/api/"] as const;
