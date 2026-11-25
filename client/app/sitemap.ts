import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "./lib/site";

/** Date of the last content change in the repo (fixed, not build time). */
const LAST_MODIFIED = new Date("2026-11-12T15:24:26Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency,
    priority,
  }));
}
