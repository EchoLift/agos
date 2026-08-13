# Wildcard Subdomain Agency Workspace Architecture Plan (Amended)

## Overview
Transition AGENCIE agency workspaces from path-based URLs (`https://client-agos.calcie.fun/{agencySlug}`) to wildcard subdomain URLs (`https://{agencySlug}.client-agos.calcie.fun`), while preserving path-based routing for local development (`http://localhost:3000/{agencySlug}`) and maintaining strict membership-based authorization on the NestJS backend.

---

## 1. Cookie Architecture & Cross-Subdomain Auth Flow

### Production Domains
- **Backend API**: `https://server-agos.calcie.fun`
- **Frontend Workspace Subdomains**: `https://{agencySlug}.client-agos.calcie.fun`
- **Frontend Root Domain**: `https://client-agos.calcie.fun`

### Host-Only Refresh Cookie Design
- **Key Insight**: `server-agos.calcie.fun` is not a parent domain of `client-agos.calcie.fun`. Setting `Domain=.client-agos.calcie.fun` on a response from `server-agos.calcie.fun` is rejected by browser cookie security policies.
- **Solution**: Omit `Domain` attribute entirely when setting the `refreshToken` cookie on `server-agos.calcie.fun`. The browser binds the cookie as **host-only** to `server-agos.calcie.fun`.
- **eTLD+1 Same-Site Context**: `server-agos.calcie.fun` and `*.client-agos.calcie.fun` share the same effective Top-Level Domain plus one (`calcie.fun`). Requests sent to `https://server-agos.calcie.fun` with `credentials: "include"` are treated as SameSite by modern browsers, allowing `SameSite: "lax"` with `Secure: true`.

### Cross-Subdomain Bootstrap Flow
```
1. User navigates to https://pixel-creative.client-agos.calcie.fun
2. Local storage for pixel-creative origin has no accessToken
3. apiClient sends POST to https://server-agos.calcie.fun/api/v1/auth/refresh with credentials: "include"
4. Browser includes host-only refreshToken cookie for server-agos.calcie.fun
5. Backend verifies refresh token and returns { accessToken: "...", expiresIn: 900 }
6. apiClient persists accessToken in localStorage for pixel-creative.client-agos.calcie.fun
7. Subsequent API calls use Authorization: Bearer <accessToken>
```

---

## 2. Vercel Wildcard DNS & SSL Configuration

Adding a wildcard domain (`*.client-agos.calcie.fun`) to Vercel requires DNS-01 verification to issue Let's Encrypt / ZeroSSL certificates.

### Step-by-Step Vercel & DNS Setup

#### Option A: Vercel Nameservers (Recommended)
1. In Vercel Project Settings → Domains, add `*.client-agos.calcie.fun`.
2. Update NS records for `client-agos.calcie.fun` at your DNS registrar to point to Vercel NS:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. Vercel automatically issues and renews the wildcard SSL certificate.

#### Option B: External DNS with DNS-01 TXT Record
1. In Vercel Project Settings → Domains, add `*.client-agos.calcie.fun`.
2. Add standard wildcard CNAME:
   - Name: `*.client-agos.calcie.fun`
   - Target: `cname.vercel-dns.com`
3. Add ACME Challenge TXT record required by Vercel for wildcard SSL validation:
   - Name: `_acme-challenge.client-agos.calcie.fun`
   - Value: `<value provided in Vercel Dashboard under Domain Verification>`
4. Wait for Vercel certificate provisioning to show status **"Valid"**.

---

## 3. Proposed Codebase Changes

### Frontend Infrastructure Updates

#### [NEW] [workspace-url.ts](file:///Users/suryateja/Documents/agos%202/frontend/src/lib/workspace-url.ts)
Centralized URL & routing helper:
- `parseSubdomainFromHost(host: string)`: Extracts `agencySlug` if request host matches `{agencySlug}.${ROOT_DOMAIN}` and is not a reserved subdomain (`www`, `api`, `app`, `admin`, `help`, `assets`).
- `getWorkspaceUrl(agencySlug: string, path: string = "")`:
  - Production: `https://{agencySlug}.client-agos.calcie.fun/{path}`
  - Local Dev: `http://localhost:3000/{agencySlug}/{path}`
- `getWorkspaceHref(agencySlug: string, path: string = "")`: Returns relative or subdomain href based on environment.

#### [NEW] [middleware.ts](file:///Users/suryateja/Documents/agos%202/frontend/src/middleware.ts)
Next.js Edge Middleware for subdomain rewriting and legacy URL redirects:
- **Dev mode (`localhost:3000`)**: Bypasses subdomain rewrites; keeps path-based `/[agencySlug]/...` routing.
- **Production mode**:
  - Extracts subdomain from `Host` header.
  - If valid agency subdomain: rewrites request internally to `/[subdomain]/[...path]`.
  - If legacy path `/{agencySlug}/{path}` requested on root domain `client-agos.calcie.fun`: returns 307 redirect to `https://{agencySlug}.client-agos.calcie.fun/{path}`.

#### [MODIFY] [workspace-access.ts](file:///Users/suryateja/Documents/agos%202/frontend/src/lib/workspace-access.ts)
Update navigation item generators (`visibleWorkspaceNavItems`, `canAccessWorkspacePath`) to use `workspace-url` helpers.

#### [MODIFY] [WorkspaceHeader.tsx](file:///Users/suryateja/Documents/agos%202/frontend/src/components/WorkspaceHeader.tsx)
Update workspace switcher:
```ts
const switchWorkspace = async (targetAgency: Agency) => {
  const response = await activateAgency(targetAgency.id);
  const targetUrl = getWorkspaceUrl(response.agency.slug);
  window.location.href = targetUrl;
};
```

#### [MODIFY] [login/page.tsx](file:///Users/suryateja/Documents/agos%202/frontend/src/app/login/page.tsx)
Redirect post-login to `getWorkspaceUrl(currentAgency.slug)`.

---

### Backend API & Security Updates

#### [MODIFY] [main.ts](file:///Users/suryateja/Documents/agos%202/backend/apps/api/src/main.ts)
Update NestJS CORS configuration to validate requests from root and subdomains dynamically:
```ts
const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000";
app.enableCors({
  origin: (origin, callback) => {
    if (
      !origin ||
      origin === corsOrigin ||
      /\.client-agos\.calcie\.fun$/.test(origin) ||
      origin === "https://client-agos.calcie.fun" ||
      origin.startsWith("http://localhost:")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Agency-Id"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
```

#### [MODIFY] [auth.controller.ts](file:///Users/suryateja/Documents/agos%202/backend/modules/auth/controllers/auth.controller.ts)
Keep host-only cookie configuration (no `domain` option passed) on `server-agos.calcie.fun`:
```ts
private setRefreshTokenCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
```

#### [MODIFY] [email-templates.ts](file:///Users/suryateja/Documents/agos%202/backend/modules/notification/email/templates/email-templates.ts)
Update `buildDeepLink` to generate subdomain URLs when `agencySlug` is supplied.

---

## 4. Verification Plan

### Automated Unit Tests
1. `frontend/src/lib/__tests__/workspace-url.test.ts` *(NEW)*:
   - Host parsing (`socia-expert.client-agos.calcie.fun` → `socia-expert`)
   - Reserved subdomains (`www`, `api`, `app`, `help` → `null`)
   - `getWorkspaceUrl` in production vs. local dev
   - Legacy path compatibility helper
2. `backend/packages/security/guards/subdomain-auth.spec.ts` *(NEW)*:
   - Host-independent backend authorization tests (`TenantGuard` membership validation)
   - Host-only refresh cookie response header assertion

### Manual Verification
- Test local workspace routing on `localhost:3000/socia-expert`.
- Verify production cross-subdomain refresh token bootstrap flow.
