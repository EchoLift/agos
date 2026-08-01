# 2026-07-29 - Google Login, Agency Routing, and Multi-Role Memberships

## Summary

Today we tightened the real Google OAuth login path, fixed post-login routing, separated agency display names from subdomain slugs in the frontend flow, and introduced multi-role membership support so one person can work with multiple skills inside the same agency.

## Google Login

- Google OAuth remains the primary login path.
- The frontend exchanges a Google ID token with `POST /api/v1/auth/google`.
- The backend verifies real Google tokens against `GOOGLE_CLIENT_ID`.
- Development fake Google tokens are only accepted when the app is not production and the Google client ID is missing or still a placeholder.
- Google login now synchronously provisions the user profile to avoid a race where agency creation happens before the async user consumer creates the user row.
- Google profile name and avatar are stored on the user profile when available.

## Post-Login Routing

After login:

- If the user already belongs to an agency, route to that agency dashboard.
- If the user has no agency, route to `/create-agency`.

This uses the existing `GET /api/v1/organizations/me` response and checks `currentAgency`.

## Agency Creation

The create-agency flow now treats:

- `displayName` as the human-readable agency name shown in the workspace header.
- `slug` as the unique subdomain/workspace identifier.

The backend already enforces slug uniqueness through the agency slug lookup and unique database constraint.

## Multi-Role Memberships

The data model now supports one membership with many roles:

```text
Agency
  -> Membership
       -> MembershipRole[]
            -> Role
```

This allows a single person to be assigned multiple skills, such as:

- Writer
- DOP
- Editor
- Designer
- Manager

The original `Membership.roleId` remains as the primary role for backward-compatible labels and simple screens. The new `MembershipRole` table stores all assigned roles.

## Invitations

Invitations now support:

- `roleId` as the primary role.
- `roleIds` as the full assigned role list.
- optional `mobileNumber` for invitees.

When an invitation is accepted, the created membership receives all selected roles.

The latest backend development also synced the Prisma schema with the database to persist `Invitation.mobileNumber` and `invitation_roles` correctly.

## Permissions

Tenant authorization now reads all assigned membership roles and merges permissions from those roles. Owner bypass works if any assigned role is `OWNER`.

## Verification

- Prisma client generation: passed.
- Prisma schema validation: passed.
- Backend build: passed.
- Frontend lint: passed with two existing image optimization warnings.
- Frontend production build: passed.
- The previous `/` prerender error is fixed.

## Pending

- Backend lint still needs an ESLint v9 flat config; the current lint script fails before reading project code because no `eslint.config.*` file exists.
