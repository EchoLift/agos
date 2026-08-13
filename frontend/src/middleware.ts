import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { parseSubdomainFromHost } from "@/lib/workspace-url";

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

  // Skip static files, API routes and Next internals.
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  /*
   * Agency workspace subdomain:
   *
   * https://socia-expert.agencie.in/campaigns
   *
   * internally becomes:
   *
   * /socia-expert/campaigns
   */
  if (subdomain) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.agencie.in";

    // Login must only exist on central app domain.
    if (url.pathname === "/login") {
      const loginUrl = new URL("/login", appUrl);

      const requestedReturnTo = url.searchParams.get("returnTo");

      const returnTo = requestedReturnTo || `${url.protocol}//${host}/`;

      loginUrl.searchParams.set("returnTo", returnTo);

      return NextResponse.redirect(loginUrl, 307);
    }

    // Agency creation also belongs to central app,
    // but DO NOT send it through login.
    if (url.pathname === "/create-agency") {
      const createAgencyUrl = new URL("/create-agency", appUrl);

      return NextResponse.redirect(createAgencyUrl, 307);
    }

    const newPath =
      `/${subdomain}` + `${url.pathname === "/" ? "" : url.pathname}`;

    const rewriteUrl = new URL(newPath, req.url);

    rewriteUrl.search = url.search;

    return NextResponse.rewrite(rewriteUrl);
  }

  /*
   * Production legacy path:
   *
   * app.agencie.in/socia-expert/campaigns
   *
   * becomes:
   *
   * socia-expert.agencie.in/campaigns
   */
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

        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "agencie.in";

        const protocol = req.nextUrl.protocol || "https:";

        const targetUrl =
          `${protocol}//${maybeSlug}.${rootDomain}` +
          `${remainingPath ? `/${remainingPath}` : ""}` +
          `${url.search}`;

        return NextResponse.redirect(new URL(targetUrl), 307);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
