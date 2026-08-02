# AGOS Identity And Workspace Implementation Plan

Date: 2026-08-02

## Scope

This pass implements only Slices 1 through 4 from `backend/docs/prmpt.md`.

Out of scope:

- ClientContact / client portal model.
- Unrelated client module changes.
- New workflow, calendar, campaign, or notification product features.

## Mandatory Constraints

1. Invitation claiming must be transactional and idempotent.
2. Concurrent or repeated logins must not create duplicate memberships or roles.
3. `MembershipRole` is authoritative for authorization.
4. `Membership.roleId` remains a legacy/display fallback only during migration.
5. Add consistency checks between `Membership.roleId` and `MembershipRole`.
6. Workspace switching must validate membership server-side and update `Session.activeAgencyId` transactionally where relevant.
7. All agency-scoped frontend caches must be invalidated or namespaced after switching.
8. Do not implement ClientContact yet.
9. Do not modify unrelated client modules.
10. Move the hardcoded role override behind an explicit development-only flag.
11. Add tests before declaring each slice complete.
12. Use the existing outbox/event pattern for invitation acceptance and membership creation.

## Existing Architecture

- `AuthUser` is the universal login identity.
- `AuthIdentity` stores OAuth provider identities.
- `User` is the universal profile, one-to-one with `AuthUser`.
- `Membership` connects a universal user to an agency.
- `MembershipRole` stores all effective agency-scoped roles for a membership.
- `Membership.roleId` still exists as primary display/fallback compatibility.
- `Session.activeAgencyId` stores the active workspace.
- `TenantGuard` resolves the request agency and membership.
- `PermissionsGuard` checks permissions populated by `TenantGuard`.

## Slice 1: Central Email Normalization

Goal:

- Make email normalization and lookup hashing consistent for password auth, Google OAuth, invitations, and future identity flows.

Implementation:

- Add a single reusable email normalization method.
- Route all auth and invitation email hash generation through that method.
- Add shared identity lookup helpers in the auth repository/service layer.

Tests:

- Same email with case/spacing differences resolves to same hash.
- Google lookup and password lookup use the same normalized hash.
- Existing identity lookup by provider still works.

Validation:

- Formatter.
- Backend lint/type/build.
- Focused auth tests.

## Slice 2: Automatic Pending Invitation Claim

Goal:

- After verified login, automatically claim all pending invitations matching the user email hash.

Implementation:

- Add repository method to find pending invitations by normalized email hash.
- Add transactional claim method.
- For each pending invitation:
  - If active membership already exists for the agency/user, mark invitation accepted without creating a duplicate membership.
  - If no membership exists, create membership and membership roles in the same transaction.
  - Use unique constraints and existing `@@unique([agencyId, userId])` as the final concurrency guard.
  - Use `MembershipRole` create-many with deterministic unique role ids.
  - Emit outbox events for invitation acceptance and membership creation.
- Call claim service after successful verified login and user provisioning.

Tests:

- First login claims invitation and creates membership.
- Repeated login does not duplicate membership.
- Repeated login does not duplicate membership roles.
- Existing membership plus pending invitation is idempotently accepted.
- Multiple agency invitations for same email are claimed.

Validation:

- Formatter.
- Backend lint/type/build.
- Focused organization/auth tests.

## Slice 3: MembershipRole Authorization Source

Goal:

- Treat `MembershipRole` as authoritative everywhere role authorization is resolved.

Implementation:

- Update membership role mapping helpers to prefer `MembershipRole`.
- Use `Membership.roleId` only if no membership roles exist.
- Add consistency check helper:
  - Missing primary `roleId` inside `MembershipRole` should be reported/fixed where writes occur.
  - Role updates must keep `roleId` included in `MembershipRole`.
- Ensure API responses expose `roles[]` consistently.
- Update `TenantGuard` to derive role keys and permissions from `MembershipRole`, with legacy fallback only.

Tests:

- Multi-role membership exposes all role keys.
- Authorization permissions are derived from all membership roles.
- Legacy membership with only `roleId` still works.
- Role update keeps `roleId` and `MembershipRole` consistent.

Validation:

- Formatter.
- Backend lint/type/build.
- Focused security/organization tests.

## Slice 4: Workspace Switching Hardening

Goal:

- Make active agency switching safe, validated, and reflected correctly in frontend state.

Implementation:

- Validate active membership server-side before switching.
- Update `Session.activeAgencyId` inside repository transaction.
- Emit `WorkspaceActivated` outbox event.
- Return agency, membership id, role list, and active agency id from activation response.
- Ensure frontend refreshes profile/membership/workspace context after switching.
- Namespace or invalidate agency-scoped frontend state after switching.
- Render forbidden workspace access clearly if URL slug is not in user memberships.

Tests:

- Cannot activate agency without active membership.
- Activation updates only the current session.
- Activation response includes current roles.
- Frontend API contract handles refreshed active agency.

Validation:

- Formatter.
- Backend lint/type/build.
- Frontend lint/build where touched.
- Focused organization tests.

## Migration Approach

No database migration is planned for Slices 1-4.

Reason:

- `AuthUser`, `AuthIdentity`, `User`, `Membership`, `MembershipRole`, `Invitation`, and `Session.activeAgencyId` already exist.
- Pending people can continue to live as `Invitation` records until they log in.
- Nullable `Membership.userId` is deferred because it is a larger ClientContact/onboarding architecture decision.

## Manual Verification

1. Invite a new email to an agency.
2. Log in with Google using that email.
3. Confirm the agency appears in the profile workspace switcher.
4. Switch into that workspace.
5. Confirm navigation and permissions match membership roles.
6. Refresh browser and confirm active workspace remains correct.
7. Repeat login and confirm no duplicate membership or duplicate role rows are created.
8. Invite the same email to a second agency and repeat login.
9. Confirm both agencies appear and can be switched.

## Remaining Future Phase

ClientContact should be designed separately as:

- Client organization remains `Client`.
- Client-side people become contacts linked to client and optionally to universal `User`.
- Client portal access is modeled as membership/contact capability, not as global user type.
