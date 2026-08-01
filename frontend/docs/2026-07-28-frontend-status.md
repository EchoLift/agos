# Frontend Status — July 28, 2026

## Summary
Phase 5 Frontend API Integration is complete. All five core modules are now wired to real backend endpoints with real database persistence. The frontend is no longer a mock — it writes to and reads from Postgres.

---

## What Was Delivered Today

### API Client Infrastructure
- `src/lib/api-client.ts` — Central authenticated `fetch` wrapper that:
  - Automatically injects `Authorization: Bearer <token>` on every request.
  - Injects `X-Agency-Id` header to satisfy the backend `TenantGuard`.
  - Handles 401 responses by clearing the token and redirecting to `/login`.
  - Standardizes error parsing from JSON or plain text responses.
- `src/lib/api/organization.ts` — `createAgency()` and `getMyMemberships()` wrappers.

### Agency Module — Root Cause Fix
- `create-agency/page.tsx` — **Previously a stub.** Now calls `POST /v1/organizations/agencies`, reads the real `agency.slug` from the response, and navigates to `/{slug}`. The `agencies` table is now populated on creation.
- `src/components/AgencyProvider.tsx` — New client-side React context that:
  - Calls `GET /v1/organizations/me` on mount.
  - Maps the URL's `agencySlug` → `agencyId` UUID.
  - Exposes `{ agencyId, agencySlug, agency }` to all child pages via `useAgency()`.
  - Shows a loading state while resolving, and a scoped error state if the agency is not found.
- `app/[agencySlug]/layout.tsx` — Wrapped children in `<AgencyProvider>` so all workspace pages inherit the resolved agency context automatically.

### Client Module
- `src/lib/api/clients.ts` — `getClients(agencyId)` and `createClient(agencyId, data)`.
- `app/[agencySlug]/clients/page.tsx` — Table view of all clients for the agency with empty state.
- `app/[agencySlug]/clients/new/page.tsx` — Form: Name, Industry, Audience, Brand Voice. Writes to `POST /v1/clients`.

### Team Module
- `src/lib/api/team.ts` — API wrappers for fetching roles, members, and sending invitations.
- `app/[agencySlug]/team/page.tsx` — Lists all active members and their roles.
- `app/[agencySlug]/team/new/page.tsx` — Onboarding form to invite an employee by email and select a role (dropdown from live API).

### Campaign Module
- `src/lib/api/campaigns.ts` — `getCampaigns(agencyId)` and `createCampaign(agencyId, data)`.
- `app/[agencySlug]/campaigns/page.tsx` — Table view of campaigns with empty state.
- `app/[agencySlug]/campaigns/new/page.tsx` — Form: Client (dropdown from live API), Name, Objective, Start Date, End Date, **and Team Assignment**. Existing employees are fetched via `getMembers()`, grouped by their role, and presented as selectable options to assign them to the campaign. Writes to `POST /v1/campaigns` passing `assignedMembershipIds`.

### Content Module
- `src/lib/api/content.ts` — `getContentAssets(agencyId)` and `createContentAsset(agencyId, data)`. Uses correct backend path `/content-assets`.
- `app/[agencySlug]/content/page.tsx` — Table view of content assets showing title, type, and stage.
- `app/[agencySlug]/content/new/page.tsx` — Form: Campaign (dropdown), Title, Type (REEL/CAROUSEL/etc.), Brief. Writes to `POST /v1/content-assets`. Auto-resolves `clientId` from the selected campaign.

### Workflow Module
- `src/lib/api/workflow.ts` — `getWorkflowTasks(agencyId)`.
- `app/[agencySlug]/workflow/page.tsx` — Table view showing task title, type, stage, and status. Read-only for now; stage advancement via the workflow engine will come in Phase 10.

### Dashboard Wiring
- `src/lib/api/dashboard.ts` — Refactored to use `apiClient` with `agencyId` injection.
- `app/[agencySlug]/page.tsx` — Dashboard now fetches data using the resolved `agencyId` from `AgencyProvider`. "Create Client" button now routes to `/clients/new` instead of a mock timeout.

---

## Architecture Decisions

### Slug → UUID Resolution (AgencyProvider)
The backend `TenantGuard` requires an `agencyId` UUID. The frontend URL uses human-readable `agencySlug`. The `AgencyProvider` bridges this gap by calling `GET /v1/organizations/me` once per workspace session and finding the matching agency by slug. The UUID is then injected as `X-Agency-Id` on every subsequent API call.

### API Client Design
All API calls go through `apiClient()` in `lib/api-client.ts`. Individual module files (`clients.ts`, `campaigns.ts`, etc.) are thin wrappers that define typed interfaces and call `apiClient` with the correct path and method. This makes the API surface easy to extend and centralizes auth/error logic.

---

## Current State

| Route | Status |
|-------|--------|
| `/login` | ✅ Google OAuth + JWT persistence |
| `/create-agency` | ✅ Writes to DB |
| `/[slug]` (Dashboard) | ✅ Reads live data via `agencyId` + Added Team Onboarding step |
| `/[slug]/team` | ✅ List + Invite Team Members |
| `/[slug]/clients` | ✅ List + Create |
| `/[slug]/campaigns` | ✅ List + Create (with Team Assignments) |
| `/[slug]/content` | ✅ List + Create |
| `/[slug]/workflow` | ✅ Read-only task view |

---

## TypeScript
- `npx tsc --noEmit` passes with zero errors.

---

## Next Planned Work
- **Founder Dashboard endpoint**: Implement the `GET /dashboard` aggregation on the backend so the dashboard shows real operational data.
- **Workflow stage advancement UI**: Allow users to move content through stages directly from the workflow page.
- **Client detail view**: View and edit an individual client.
- **Campaign detail view**: View campaigns and their associated content assets.
- **Subdomain routing**: `agency.agos.com` pattern for production.
- **Employee workspace**: Role-scoped task views for writers, editors, and managers.
