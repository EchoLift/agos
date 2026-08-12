import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSubdomainFromHost } from "@/lib/workspace-url";

// Root paths that live outside [agencySlug]
const ROOT_ROUTES = new Set([
  "",
  "/",
  "/login",
  "/create-agency",
  "/demo",
  "/demo-workspace",
  "/privacy",
  "/terms",
  "/favicon.ico",
]);

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get("host");
  const subdomain = parseSubdomainFromHost(host);

  // Skip static files, api routes, _next internals
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1. Subdomain-based request (e.g. socia-expert.client-agos.calcie.fun/campaigns)
  if (subdomain) {
    // If request is trying to access root routes on subdomain (like /login), allow root
    if (url.pathname === "/login" || url.pathname === "/create-agency") {
      return NextResponse.next();
    }

    // Rewrite /path -> /[subdomain]/path
    const newPath = `/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(new URL(newPath, req.url));
  }

  // 2. Production legacy path redirect (e.g. https://client-agos.calcie.fun/socia-expert/campaigns)
  // Only redirect if NOT on localhost
  const hostname = (host || "").split(":")[0].toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  if (!isLocal && process.env.NODE_ENV === "production") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const maybeSlug = segments[0];
      const isRootRoute = ROOT_ROUTES.has(`/${maybeSlug}`) || maybeSlug.startsWith("help");
      if (!isRootRoute) {
        // Safe redirect legacy path-based URL to subdomain
        const remainingPath = segments.slice(1).join("/");
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "client-agos.calcie.fun";
        const protocol = req.nextUrl.protocol || "https:";
        const targetUrl = `${protocol}//${maybeSlug}.${rootDomain}${remainingPath ? `/${remainingPath}` : ""}${url.search}`;
        return NextResponse.redirect(new URL(targetUrl), 307);
      }
    }
  }

  // Dev mode (localhost:3000) or root routes -> normal next routing
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
