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

export function isReservedSubdomain(
  subdomain: string,
): boolean {
  return RESERVED_SUBDOMAINS.has(
    subdomain.toLowerCase().trim(),
  );
}

/**
 * Extracts agency slug from Host header or window.location.host in production.
 *
 * Examples:
 * socia-expert.agencie.in -> socia-expert
 * app.agencie.in          -> null
 * agencie.in              -> null
 * localhost:3000          -> null
 */
export function parseSubdomainFromHost(
  host: string | null | undefined,
): string | null {
  if (!host) return null;

  const hostname = host
    .split(":")[0]
    .toLowerCase()
    .trim();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    "agencie.in"
  ).toLowerCase();

  if (hostname.endsWith(`.${rootDomain}`)) {
    const parts = hostname
      .slice(0, -(rootDomain.length + 1))
      .split(".");

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

/**
 * Returns the central AGENCIE application URL.
 *
 * Production:
 * https://app.agencie.in
 *
 * Development:
 * http://localhost:3000
 */
export function getRootDomainUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost")
    ) {
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
 * Generates a full workspace URL.
 *
 * Dev:
 * getWorkspaceUrl("socia-expert")
 * -> http://localhost:3000/socia-expert
 *
 * getWorkspaceUrl("socia-expert", "campaigns")
 * -> http://localhost:3000/socia-expert/campaigns
 *
 * Production:
 * getWorkspaceUrl("socia-expert")
 * -> https://socia-expert.agencie.in
 *
 * getWorkspaceUrl("socia-expert", "campaigns")
 * -> https://socia-expert.agencie.in/campaigns
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

  const isDev =
    process.env.NODE_ENV !== "production";

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
      process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
      "agencie.in";

    return `${protocol}//${agencySlug}.${rootDomain}${cleanPath}`;
  }

  if (isDev) {
    return `http://localhost:3000/${agencySlug}${cleanPath}`;
  }

  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    "agencie.in";

  return `https://${agencySlug}.${rootDomain}${cleanPath}`;
}

/**
 * Returns a relative href when already inside the requested workspace.
 *
 * Example:
 *
 * Current:
 * https://socia-expert.agencie.in
 *
 * getWorkspaceHref("socia-expert", "/campaigns")
 * -> /campaigns
 *
 * If switching workspace:
 *
 * getWorkspaceHref("infinitum-media", "/campaigns")
 * -> https://infinitum-media.agencie.in/campaigns
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
    const currentSubdomain =
      parseSubdomainFromHost(
        window.location.host,
      );

    if (currentSubdomain === agencySlug) {
      return cleanPath || "/";
    }
  }

  return getWorkspaceUrl(
    agencySlug,
    cleanPath,
  );
}