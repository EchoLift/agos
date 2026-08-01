# 2026-07-30 - Activation Sync and Employee Role Management

## Slice 1: Employee Role Management

Implemented owner-facing member management for agencies.

### Backend

Added endpoints:

```text
GET    /api/v1/organizations/:agencyId/members
PATCH  /api/v1/organizations/:agencyId/members/:membershipId/role
DELETE /api/v1/organizations/:agencyId/members/:membershipId?version=2
```

Role update body:

```json
{
  "roleId": "role-uuid",
  "version": 2
}
```

Business rules:

- `OWNER` and `MANAGER` can change member roles.
- `MANAGER` cannot change their own role.
- `MANAGER` cannot change an `OWNER` role.
- `MANAGER` cannot assign the `OWNER` role.
- Only `OWNER` can remove members.
- Owner cannot remove themselves.
- Last active owner cannot be demoted.
- Last active owner cannot be removed.
- Target membership must belong to the route agency.
- Target role must be one of that agency's predefined roles.
- Role update and removal use optimistic locking via `version`.
- Writes emit outbox events in the same transaction:
  - `MemberRoleChanged`
  - `MemberRemoved`

Repository methods added:

- `findMembersByAgencyId()`
- `findMembershipById()`
- `updateMembershipRole()`
- `removeMembership()`
- `countActiveOwners()`

### Frontend

Team page now shows:

- Name and email or mobile number
- Role
- Status
- Joined date
- Actions

Actions:

- Change roles with a compact checkbox dialog.
- Remove member with confirmation.

The remove confirmation uses the target member name and agency display name.

Privacy/display refinement:

- Member emails are decrypted by the backend before returning team members.
- If email is unavailable, the UI shows mobile number.
- Encrypted field values are never displayed as contact text.
- Campaign creation assignment cards show only member name and role, not email or mobile number.

## Slice 2: Activation State

Implemented real activation state derived from database records.

### Backend

Added:

```text
GET /api/v1/activation
```

Response shape:

```json
{
  "completed": false,
  "progress": 50,
  "steps": {
    "agency": true,
    "team": true,
    "client": true,
    "campaign": false,
    "content": false,
    "workflow": false
  },
  "nextStep": "CREATE_CAMPAIGN"
}
```

Step derivation:

- `agency`: agency exists.
- `team`: active memberships > 1.
- `client`: active client count > 0.
- `campaign`: active or draft campaign count > 0.
- `content`: active content asset count > 0.
- `workflow`: active workflow instance count > 0.

`team` is recommended but not required for `completed`, so a solo founder can test the platform without inviting fake employees.

### Frontend

Dashboard setup state no longer uses local booleans.

It now fetches:

- `GET /dashboard`
- `GET /activation`

Progress and step completion come from the activation response. Browser refreshes preserve correct setup state because the state is derived from real database records.

## Verification

- Backend build passed.
- Frontend lint passed with two existing image optimization warnings.
- Frontend production build passed.
- Prisma schema validation passed.
- Prisma local database sync passed.
- Focused auth tests passed.
- Focused organization service tests passed.

## Notes

Backend lint still requires an ESLint v9 flat config before the lint script can run. This is a tooling configuration gap, not a code failure in these slices.

## 2026-07-30 Follow-up: Campaign Assignment UX and Demo Employees

Campaign creation improvements:

- Start and end date fields use native calendar date inputs with a visible dark-theme picker indicator.
- The campaign form is wider on desktop so assignment groups do not feel cramped.
- Assignment members are grouped by all assigned roles, not only primary role.
- Each role group displays member cards in up to three columns per row.
- Campaign assignment cards show member name and role only.
- Role groups are collapsed by default.
- Opening one role group closes the previously opened group.

Demo data:

- Added `scripts/seed-demo-employees.ts`.
- The script creates one active demo employee for every non-owner system role in each active agency.
- Demo employee emails are encrypted and blind-indexed with the same field encryption approach used by real auth users.
- The current local database was seeded for `SociaExpert`, which now has 11 active members including the existing owner.

## 2026-07-30 Follow-up: Multi-Role Editing

Backend:

- `PATCH /api/v1/organizations/:agencyId/members/:membershipId/role` now accepts an optional `roleIds` array.
- The endpoint keeps `roleId` as the primary role for backwards compatibility.
- The full membership role set is written to `membership_roles` in the same transaction.
- `MemberRoleChanged` outbox payload now includes `roleIds`.
- Owners and managers can edit roles.
- Managers still cannot edit their own roles, edit an owner, or assign the owner role.
- Last owner demotion protection still applies when removing the owner role from a member.

Frontend:

- Team page role editing now uses a modal with multiple role checkboxes.
- Team table shows role chips instead of a single-role dropdown.
- Campaign assignment grouping uses all roles attached to a member.

## 2026-07-30 Follow-up: Detail Routes and Editing

Frontend:

- Campaign, client, content, and workflow list actions now navigate to real dynamic detail pages.
- Added:
  - `/{agencySlug}/campaigns/{campaignId}`
  - `/{agencySlug}/clients/{clientId}`
  - `/{agencySlug}/content/{contentId}`
  - `/{agencySlug}/workflow/{contentId}`
- Campaign detail supports editing name, objective, start date, and end date.
- Client detail supports editing name, industry, audience, competitors, and brand voice.
- Content detail supports editing title, type, and brief.
- Workflow detail opens the workflow-facing view for a content asset and supports editing shared content fields.

## 2026-07-30 Follow-up: Client Optional Text Fields

- Client competitors are stored as nullable text, not as a frontend array.
- Empty competitors on edit now save as `null`.
- Backend client create/update normalizes blank optional text fields to `null` for brand voice, audience, and competitors.

## 2026-07-30 Follow-up: Profile Menu and Personal Settings

Backend:

- Added profile fields to `User`:
  - encrypted mobile number
  - mobile blind index
  - job title
  - bio
  - manual presence status
  - work location status
  - status message
  - status expiry
- Added `PresenceStatus` enum:
  - `AVAILABLE`
  - `BUSY`
  - `DO_NOT_DISTURB`
  - `AWAY`
  - `OFFLINE`
- Added personal endpoints:
  - `GET /api/v1/me/profile`
  - `PATCH /api/v1/me/profile`
  - `PATCH /api/v1/me/status`
  - `DELETE /api/v1/me/status`
- Added workspace activation:
  - `POST /api/v1/organizations/:agencyId/activate`
- Workspace activation validates active membership before updating `Session.activeAgencyId`.
- Work location supports:
  - `WFO`
  - `WFH`
  - `REMOTE`

Frontend:

- Header now has a profile menu separate from workspace settings.
- Profile menu shows avatar/initials, name, current role, current agency, and read-only email.
- Added links for:
  - My Profile
  - Status
  - Appearance
  - Switch Workspace
  - Agency Settings, visible only to owners
  - Help & Support placeholder
  - Logout
- Added pages:
  - `/{agencySlug}/settings/profile`
  - `/{agencySlug}/settings/status`
  - `/{agencySlug}/settings/appearance`
- Logout asks for confirmation before revoking the session.
- Appearance settings are stored client-side in `localStorage` for V1.
- Theme selection now applies a real workspace theme through a root `data-theme` attribute.
- Light theme is implemented through global overrides for the dark utility classes currently used across the app.
- Notification preferences remain a next slice, not part of the V1 profile menu implementation.

## 2026-07-30 Follow-up: Agency Settings Navigation and Light Theme Polish

Frontend:

- Agency Settings in the profile menu now opens a dedicated owner-only settings page:
  - `/{agencySlug}/settings/agency`
- The Team page remains focused on employee and role management.
- The Agency Settings page currently shows read-only agency identity, owner access details, and links to existing workspace controls.
- Light theme table row hover states now use a subtle light surface instead of a dark gray overlay.
- Light theme table dividers are softened for team/member rows.

## 2026-07-30 Follow-up: Campaign Activation

Backend:

- Added explicit campaign activation endpoint:
  - `POST /api/v1/campaigns/:id/activate`
- Campaign creation still starts as `DRAFT`.
- Campaign activation is a manual lifecycle action, not an automatic start-date/end-date calculation.
- Activation uses optimistic locking through campaign `version`.
- Activation emits `CampaignActivated`.

Frontend:

- Campaign detail pages now show a `Make active` action for draft campaigns.
- Activation asks for confirmation before changing status.
- Campaign status pills now visually distinguish draft, active, and archived states.
