const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "help",
  "assets",
  "static",
  "status",
  "auth",
  "cdn",
  "mail",
]);

export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase().trim());
}

/**
 * Extracts agency slug from Host header or window.location.host in production.
 * Returns null if on localhost, IP address, root domain, or a reserved subdomain.
 */
export function parseSubdomainFromHost(
  host: string | null | undefined,
): string | null {
  if (!host) return null;

  // Strip port if present
  const hostname = host.split(":")[0].toLowerCase().trim();

  // If localhost, IP, or dev host, no subdomain routing
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "agencie.in"
  ).toLowerCase();

  // Check if host ends with .rootDomain
  if (hostname.endsWith(`.${rootDomain}`)) {
    const parts = hostname
      .slice(0, -(rootDomain.length + 1))
      .split(".");

    // Only single-level agency subdomains:
    // socia-expert.agencie.in
    if (
      parts.length === 1 &&
      parts[0] &&
      !isReservedSubdomain(parts[0])
    ) {
      return parts[0];
    }
  }

  return null;
}

export function getRootDomainUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return `http://${window.location.host}`;
    }

    const protocol = window.location.protocol;

    return (
      process.env.NEXT_PUBLIC_APP_URL ||
      `${protocol}//app.agencie.in`
    );
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.agencie.in"
  );
}

/**
 * Generates an environment-aware full workspace URL.
 *
 * Dev:
 * http://localhost:3000/socia-expert/campaigns
 *
 * Production:
 * https://socia-expert.agencie.in/campaigns
 */
export function getWorkspaceUrl(
  agencySlug: string,
  path: string = "",
): string {
  const cleanPath = path.startsWith("/")
    ? path
    : path
      ? `/${path}`
      : "";

  const isDev = process.env.NODE_ENV !== "production";

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      isDev
    ) {
      return `http://${window.location.host}/${agencySlug}${cleanPath}`;
    }

    const protocol = window.location.protocol;
    const rootDomain =
      process.env.NEXT_PUBLIC_ROOT_DOMAIN || "agencie.in";

    return `${protocol}//${agencySlug}.${rootDomain}${cleanPath}`;
  }

  if (isDev) {
    return `http://localhost:3000/${agencySlug}${cleanPath}`;
  }

  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "agencie.in";

  return `https://${agencySlug}.${rootDomain}${cleanPath}`;
}

/**
 * Returns a relative href if already on the agency subdomain.
 * Otherwise returns the environment-aware workspace URL.
 */
export function getWorkspaceHref(
  agencySlug: string,
  path: string = "",
): string {
  const cleanPath = path.startsWith("/")
    ? path
    : path
      ? `/${path}`
      : "";

  if (typeof window !== "undefined") {
    const currentSubdomain = parseSubdomainFromHost(
      window.location.host,
    );

    if (currentSubdomain === agencySlug) {
      return cleanPath || "/";
    }
  }

  return getWorkspaceUrl(agencySlug, cleanPath);
}