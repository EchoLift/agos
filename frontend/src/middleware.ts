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


  if (subdomain) {
    if (url.pathname === "/login" || url.pathname === "/create-agency") {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://app.agencie.in";

      const loginUrl = new URL("/login", appUrl);

      const requestedReturnTo = url.searchParams.get("returnTo");

      const returnTo =
        requestedReturnTo || `${url.protocol}//${host}/`;

      loginUrl.searchParams.set("returnTo", returnTo);
      
      return NextResponse.redirect(loginUrl, 307);
    }

    const newPath =
      `/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;

    return NextResponse.rewrite(new URL(newPath, req.url));
  }

  // 2. Production legacy path redirect
  // e.g. https://app.agencie.in/socia-expert/campaigns
  // -> https://socia-expert.agencie.in/campaigns
  //
  // Only redirect if NOT on localhost.
  const hostname = (host || "").split(":")[0].toLowerCase();

  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  if (!isLocal && process.env.NODE_ENV === "production") {
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length > 0) {
      const maybeSlug = segments[0];

      const isRootRoute =
        ROOT_ROUTES.has(`/${maybeSlug}`) || maybeSlug.startsWith("help");

      if (!isRootRoute) {
        const remainingPath = segments.slice(1).join("/");

        const rootDomain =
          process.env.NEXT_PUBLIC_ROOT_DOMAIN || "agencie.in";

        const protocol = req.nextUrl.protocol || "https:";

        const targetUrl =
          `${protocol}//${maybeSlug}.${rootDomain}` +
          `${remainingPath ? `/${remainingPath}` : ""}` +
          `${url.search}`;

        return NextResponse.redirect(new URL(targetUrl), 307);
      }
    }
  }

  // Dev mode (localhost:3000) or root routes -> normal Next.js routing
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static
     * - _next/image
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};