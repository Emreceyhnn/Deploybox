import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next's built-in gzip buffers the whole response before sending it, which
  // breaks long-lived streams (SSE build/deploy logs never flush). Nginx (or
  // the platform we deploy behind) handles compression for everything else.
  compress: false,
  // The dev-mode route indicator (bottom-left corner badge) overlaps real
  // page content on narrow viewports (e.g. the mobile "Projects" heading) —
  // it's dev-only tooling, not part of the shipped product, so turn it off
  // rather than let it visually collide with the UI during local testing.
  devIndicators: false,
};

export default nextConfig;
