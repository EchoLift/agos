# Google OAuth Implementation

Date: July 26, 2026

## Decision

The frontend now exchanges a Google credential with the backend through the client-side Google Identity Services flow. The backend verifies the token, then creates the same server-managed session used by manual login.

## Current implementation status

The auth flow is now implemented for local development and connected to the frontend login experience:

- The frontend sends a token to `POST /api/v1/auth/google` from the login screen.
- The backend verifies the token, accepts a local development fallback token, and returns an access token plus a refresh cookie.
- The implementation supports both a real Google ID token and a dev token of the form `dev-google-token:demo@agos.local` when no Google client ID is configured yet.
- The cookie path and CORS settings are configured so the browser can persist the refresh session for the frontend app.

## Backend behavior

`POST /auth/google` now:

1. Accepts `{ "token": "google-id-token" }`.
2. Verifies the token with `google-auth-library` when a real Google credential is supplied.
3. Accepts a development fallback path for local testing without a configured Google client ID.
4. Requires `email`, `sub`, and `email_verified = true` for real Google tokens.
5. Links or creates the auth user and provider identity as needed.
6. Creates a normal server-managed session.
7. Returns an access token and sets the refresh token cookie.

## Files involved

```text
backend/modules/auth/controllers/auth.controller.ts
backend/modules/auth/services/auth.service.ts
backend/modules/auth/repositories/auth-user.repository.ts
backend/modules/auth/dto/google-oauth.dto.ts
backend/modules/auth/services/auth.service.spec.ts
backend/apps/api/src/main.ts
frontend/src/app/login/page.tsx
frontend/src/lib/auth.ts
frontend/src/lib/google-auth.ts
```

## Verification

Completed on July 26, 2026:

```bash
cd backend && npm run build
curl -i -X POST http://localhost:4000/api/v1/auth/google -H 'Content-Type: application/json' -d '{"token":"dev-google-token:demo@agos.local"}'
```

Results:

- Backend build passed.
- Live auth request returned `HTTP/1.1 200 OK` with an access token and refresh cookie.
