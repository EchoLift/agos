# Project Status — July 28, 2026

## Overview
Today's session completed **Phase 5 Frontend API Integration** and then iterated with two follow-up sessions covering auth robustness, team onboarding APIs, post-login smart routing, and the agency display name / subdomain split. The platform is now end-to-end: from Google OAuth → database persistence → operational workspace with correct routing.

---

## Latest Snapshot (July 28, 2026 — Session 2)

### Post-Login Smart Routing
The login flow now intelligently routes users based on their account state:
- After Google sign-in → `GET /organizations/me` is called
- **Has an agency** → navigates to `/{slug}` (workspace dashboard)
- **No agency** → navigates to `/create-agency`
- If a valid access token exists on page load → same routing fires without re-login
- If the token is revoked or refresh fails → stale token is cleared, user stays on `/login`

### Agency Display Name + Subdomain Split
The agency creation flow now distinguishes between two separate concepts:
- **`displayName`** — human-readable label shown in the workspace header (e.g. `Social Expert Media`)
- **`slug`** — unique subdomain identifier used in the URL (e.g. `social-expert`)

Frontend form auto-fills the slug from the display name but allows manual override with live URL preview (`social-expert.agos.com`). Slug uniqueness is enforced server-side (`409 Conflict` returned if taken).

**Schema change**: Added `displayName String @default("")` to the `Agency` model, applied via `prisma db push`.

### Workspace Header Shows Real Display Name
- New `WorkspaceHeader` client component reads `agencyDisplayName` from `AgencyContext`
- `AgencyProvider` now exposes `agencyDisplayName` (falls back to `name` → `slug` for legacy agencies)
- Layout no longer derives a fake brand name from the slug

### Auth Robustness (Session 1)
- Silent `refreshAccessToken` flow: on `401`, frontend retries with a fresh token before redirecting
- Secure `logout()` hits the backend to revoke the session cookie, then clears `localStorage`
- Passive `getAccessToken()` returns `null` on expiry (does not delete the token — lets refresh handle it)

---

## Session 1 Changes (Earlier Today)

### Root Cause Fixed: Agency Table Empty
The `agencies` table was empty after agency creation because the `create-agency` page was a **UI stub** — it computed the slug client-side and navigated without ever calling the backend. This is now fully resolved.

### What Changed in Session 1
- **Database persistence confirmed**: `auth_users` and `users` tables were already writing correctly from previous sessions. The `agencies` table issue was purely a missing frontend API call.
- **Full frontend-to-database wiring**: Every core module (Agency, Client, Campaign, Content Asset, Workflow) is now connected to real backend endpoints with real Prisma queries.
- **Synchronous user provisioning**: `AuthService` now calls `UserService.provisionUser()` synchronously during Google login, eliminating the race condition where a `User` record did not exist when the frontend attempted to create an Agency.
- **Team Onboarding APIs**: Added `GET /organizations/roles` and `GET /organizations/members` to list roles and active agency members.
- **Campaign Team Assignments**: Updated the Prisma Schema (`Campaign` many-to-many `Membership`) and the `POST /campaigns` endpoint to connect assigned team members securely upon campaign creation.

---

## Backend Roadmap Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation | ✅ Complete |
| 1 | Auth (password + Google OAuth) | ✅ Complete |
| 2 | User provisioning | ✅ Complete |
| 3 | Organization & Tenancy | ✅ Complete |
| 4 | Gateway Security | ✅ Complete |
| 5 | Client Module | ✅ Complete |
| 6 | Campaign Module | ✅ Complete |
| 7 | Content Asset Module | ✅ Complete |
| 8 | Workflow Engine | ✅ Complete |
| 9 | Submission System | ✅ Complete |
| 10 | Founder Dashboard | ⬜ Next |
| 11 | Employee Workspace APIs | ⬜ Planned |
| 12 | Notifications | ⬜ Planned |

---

## Backend Architecture Highlights

### PrismaService
Refactored to be a clean `PrismaClient` extension (fixed issue where `$extends` was discarding the original client instance).

### AuthUserRepository
All methods fully rewritten to use real Postgres queries via `PrismaService`. No in-memory stubs remain in any module — confirmed via codebase audit (`grep -rn "private readonly.*: .*\[\]"`).

### Tenant Resolution (`TenantGuard`)
Resolves `agencyId` in priority order:
1. Path param: `/:agencyId/...`
2. Session: `activeAgencyId`
3. Header: `X-Agency-Id`

Frontend now sends the `X-Agency-Id` header on every authenticated request using the `AgencyProvider` context.

---

## Phase 9: Submission System (✅ COMPLETED)
See `2026-07-26-project-status.md` for full details on phases 0-9.

---

## Phase 10: Founder Dashboard (⬜ NEXT)

### User Story
As a founder, I want to see what is at risk, blocked, waiting for approval, and publishing today so that I can act quickly without checking WhatsApp.

### Scope
- Active clients count
- Active campaigns count
- Active content count
- Blocked items count
- My task queue (content assigned to me)
- Pending approvals
- Latest activity feed

### Current State
Dashboard endpoint (`GET /api/v1/dashboard`) exists and is called by the frontend but returns placeholder data. The aggregation query needs to be implemented.

---

## Product Readiness Summary

### All Modules Have Real DB Persistence
Confirmed via Prisma Studio:
- `auth_users` ✅
- `users` ✅  
- `agencies` ✅ — with `displayName` + `slug` properly separated
- `memberships` ✅
- `clients` ✅
- `campaigns` ✅
- `content_assets` ✅

### Full Founder Journey Is Now Unblocked
1. Google OAuth → creates `auth_user` + `user` synchronously
2. Login → smart routing to dashboard or `/create-agency` based on existing agency
3. Create Agency → sets display name + unique subdomain, creates `agency` + `membership` + `outbox_event`
4. Header shows real display name from `AgencyContext`
5. Create Client → tenant-scoped to agency UUID
6. Onboard Team → fetch roles and active members, invite via email
7. Create Campaign → validates client belongs to agency, links assigned members
8. Create Content Asset → linked to campaign + client
9. Workflow → tracks stage progression
