export function getProjectDomain(subdomain: string, customDomain?: string | null): string {
  if (customDomain) return customDomain;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.APP_DOMAIN;
  if (appDomain) {
    return `${subdomain}.${appDomain}`;
  }

  return `${subdomain}.emreceyhan.xyz`;
}

export function getProjectFullUrl(
  subdomain: string,
  customDomain?: string | null,
  hostPort?: number | null
): string {
  if (customDomain) {
    return customDomain.startsWith("http") ? customDomain : `https://${customDomain}`;
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.APP_DOMAIN;
  if (appDomain) {
    const protocol = appDomain.includes("localhost") || appDomain.includes("127.0.0.1") ? "http" : "https";
    return `${protocol}://${subdomain}.${appDomain}`;
  }

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    // In local dev, if Docker mapped an assigned host port (e.g. 49152, 55432, etc. where hostPort != 3000),
    // point directly to http://localhost:hostPort so clicking 'View Live' opens the actual running container!
    if (hostPort && hostPort > 0) {
      return `http://localhost:${hostPort}`;
    }
  }

  // Production or fallback domain
  return `https://${subdomain}.emreceyhan.xyz`;
}
