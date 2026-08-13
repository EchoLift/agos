# Routing Overview

This document summarizes routing behavior across the AGENCIE frontend and backend, with the goal of helping developers understand how auth, tenant selection, and workspace navigation are resolved.

## Frontend routes

### `/`
- Public landing page.
- Contains `RootRedirect` client component.
- If a valid access token is present, `RootRedirect` calls `GET /organizations/me` and redirects to the first available agency slug.
- If no valid token is present, the landing page stays visible.

### `/login`
- Login page for Google sign-in.
- On successful Google sign-in, exchanges the ID token with `POST /auth/google`.
- After successful auth, calls `GET /organizations/me` and routes to:
  - `/{currentAgency.slug}` if `currentAgency` exists
  - `/create-agency` otherwise

### `/create-agency`
- Agency creation page.
- Creates a new agency via `POST /organizations/agencies`.
- On success, navigates to `/{agency.slug}`.

### `/[agencySlug]`
- Primary workspace dashboard route.
- `AgencyProvider` loads membership data and validates that `agencySlug` belongs to the authenticated user.
- If the agency does not belong to the current user, it shows an access error.

### `/[agencySlug]/campaigns`
- Campaign list page for the current agency.

### `/[agencySlug]/campaigns/new`
- Create campaign page.

### `/[agencySlug]/clients`
- Client list page.

### `/[agencySlug]/clients/new`
- Create client page.

### `/[agencySlug]/content`
- Content list page.

### `/[agencySlug]/content/new`
- Create content page.

### `/[agencySlug]/workflow`
- Workflow page for the current agency.

### `/[agencySlug]/team`
- Team member list page.

### `/[agencySlug]/team/new`
- Invite team member page.
- Uses `inviteMember` API wrapper.
- New invite supports `email`, optional `mobileNumber`, primary `roleId`, and additional `roleIds`.

## Frontend routing helpers

### `RootRedirect`
- Client component rendered on `/`.
- If `getAccessToken()` returns a token, it calls `GET /organizations/me`.
- If the user has a current or first agency, it redirects to `/{agency.slug}`.
- Otherwise, it does nothing and preserves the landing page.

### `AuthGate`
- Used inside workspace pages to guard authenticated routes.
- If `getAccessToken()` is missing, it redirects to `/login`.

### `AgencyProvider`
- Fetches `GET /organizations/me` and finds the agency matching `agencySlug`.
- Provides `agencyId`, `agencySlug`, `agencyDisplayName`, and `agency` to workspace subpages.
- Shows a loading state while fetching and an error state if the slug is invalid.

## Backend routing

### `POST /api/v1/auth/google`
- Authenticates Google ID token.
- Creates or links the user.
- Creates a session and returns an access token.
- Sets a refresh token cookie.

### `GET /api/v1/organizations/me`
- Determines the user’s active agency.
- Resolution order:
  1. `session.activeAgencyId` if available
  2. first available agency membership
- Returns `activeAgencyId`, `currentAgency`, and `agencies`.

### `POST /api/v1/organizations/agencies`
- Creates an agency.
- Provisions default roles.
- Creates owner membership.
- Updates `session.activeAgencyId` to the new agency.

### `POST /api/v1/organizations/:agencyId/invitations`
- Creates an invitation for the agency.
- Accepts:
  - `email`
  - optional `mobileNumber`
  - primary `roleId`
  - additional `roleIds`
- Stores invitations in `invitations` and `invitation_roles`.

### `POST /api/v1/organizations/invitations/:token/accept`
- Accepts pending invitation via token.
- Creates membership and assigns roles.

## Notes for developers

- Workspace routes are always tenant-scoped by `agencySlug`.
- The frontend keeps a separate landing experience at `/`, but authenticated users should not stay there if they already have an agency.
- `GET /organizations/me` is the central contract for routing decisions after login and on workspace load.
- `session.activeAgencyId` is the source of truth for active-tenant selection.
