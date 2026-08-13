# AGENCIE Capability Reference

Audit date: 2026-08-10

This is the internal product truth for AGENCIE. Owner-facing help pages should be written from this reference, but should not expose implementation details such as database table names, event payloads, or internal service names.

## Status Legend

- `AVAILABLE`: implemented in backend and surfaced in frontend.
- `PARTIALLY AVAILABLE`: implemented in one layer or usable with gaps.
- `DEVELOPMENT ONLY`: intentionally available only in local/dev workflows.
- `PLANNED`: documented or modeled, but not currently usable.
- `NOT FOUND`: not found in the audited docs or code.

## Capability Inventory

| Area | Capability | Status | Notes |
| --- | --- | --- | --- |
| Identity & Access | Google login | AVAILABLE | Frontend Google Identity Services sends an ID token to `POST /auth/google`; backend owns sessions and tokens. |
| Identity & Access | Email/password login | AVAILABLE | Existing auth remains, but OAuth is primary. |
| Identity & Access | Universal email identity | AVAILABLE | Auth and User profiles are linked by normalized encrypted email and lookup hashes. |
| Identity & Access | First-login invitation claiming | AVAILABLE | Pending invitations are claimed after verified login; membership creation uses the existing role model. |
| Identity & Access | Multiple agencies per user | AVAILABLE | `GET /organizations/me` returns all active memberships. |
| Identity & Access | Workspace switching | AVAILABLE | `POST /organizations/:agencyId/activate` validates membership and updates active agency on the session. |
| Identity & Access | Multiple roles per agency | AVAILABLE | `MembershipRole` is authoritative; legacy `roleId` remains as fallback/display compatibility. |
| Identity & Access | Profile settings | AVAILABLE | Profile read/update routes and UI exist. |
| Identity & Access | Status and work location | AVAILABLE | Status page exists for presence and WFO/WFH/Remote-style state. |
| Identity & Access | Appearance/theme | AVAILABLE | Appearance page and theme controller exist. |
| Agency Setup | Create agency | AVAILABLE | User can create an agency with unique slug/subdomain and display name. |
| Agency Setup | Agency settings | PARTIALLY AVAILABLE | Dedicated route exists, but currently lightweight. |
| Agency Setup | Predefined roles | AVAILABLE | System roles are seeded and agency roles are exposed through API. |
| Agency Setup | Invite employee | AVAILABLE | Invitation creation supports multiple role IDs. |
| Agency Setup | Role updates | AVAILABLE | Owner/manager rules plus development-only self role testing override. |
| Agency Setup | Member removal | AVAILABLE | Owner-only, with self-removal and last-owner protection. |
| Clients | Create client | AVAILABLE | Client playbook form includes general, brand, contact, audience, strategy, approval, and internal fields. |
| Clients | Client playbook details | AVAILABLE | Detail page renders role-filtered sections returned by backend. |
| Clients | Edit client | AVAILABLE | Edit mode reuses the playbook form. |
| Clients | Archive/restore client | AVAILABLE | Backend endpoints exist; frontend support may vary by page action visibility. |
| Clients | Relationship manager assignment | AVAILABLE | Backend endpoint exists. |
| Clients | Client contacts model | PARTIALLY AVAILABLE | Backend `ClientContact` API exists with encryption, primary contact, and optional User link. Frontend still mostly uses embedded primary contact fields. |
| Clients | Client portal | PLANNED | Client role exists, but a full external client workspace is not implemented. |
| Campaigns | Create campaign | AVAILABLE | Campaign form includes overview, timeline, strategy, deliverables, workflow/approval, calendar, and references. |
| Campaigns | Campaign detail dashboard | AVAILABLE | Detail page has overview, content, calendar, team, and activity tabs. |
| Campaigns | Campaign lifecycle | AVAILABLE | Activate, pause, resume, complete, archive, and restore commands exist. |
| Campaigns | Campaign team | AVAILABLE | Dedicated campaign team assignments exist and can be managed by allowed roles. |
| Campaigns | Campaign activity | AVAILABLE | Activity is visible from campaign detail. |
| Campaigns | Publishing schedule CRUD | AVAILABLE | Schedule slots can be created, edited, cancelled, marked published, and used to generate production. |
| Campaigns | Generate production | AVAILABLE | Publishing slot can generate content asset and first workflow task. |
| Campaigns | Recurring campaign automation | PLANNED | Deliverables and slots exist, but advanced recurring generation is not a full productized flow. |
| Content | Create content asset | AVAILABLE | Content can be created manually and linked to client/campaign. |
| Content | Content list/detail/edit | AVAILABLE | Frontend list/detail/edit routes exist. |
| Content | Archive/restore content | AVAILABLE | Backend endpoints exist. |
| Content | Publishing readiness | AVAILABLE | Manager edit approval can mark linked publishing schedule ready. |
| Workflow | Workflow board | AVAILABLE | Board groups content by production stage with filters and role-aware scope. |
| Workflow | Writer submission | AVAILABLE | Script/task submission command exists and is exposed. |
| Workflow | Manager review | AVAILABLE | Approve/request changes supported for review stages. |
| Workflow | DOP handover | AVAILABLE | DOP submission/handover flow exists. |
| Workflow | Editor intake | AVAILABLE | Accept/reject handover exists. |
| Workflow | Editor submission | AVAILABLE | Edit submission exists. |
| Workflow | Block/unblock | AVAILABLE | Workflow task blockers are supported. |
| Workflow | Workflow history | PARTIALLY AVAILABLE | Transitions, assignments, submissions, approvals, and blockers are stored; owner-facing chronological timeline is not complete everywhere. |
| Calendar | Role-aware calendar | AVAILABLE | Calendar events include workflow tasks, publishing slots, and work orders. |
| Calendar | My Schedule | AVAILABLE | Direct assignments and relevant campaign responsibility events. |
| Calendar | My Role | AVAILABLE | Role-based query exists. |
| Calendar | My Team/Campaign/Agency scopes | AVAILABLE | Scope support exists with access checks. |
| Calendar | Hide/unhide event groups | AVAILABLE | Frontend visible calendar checkboxes exist. |
| Calendar | Calendar deep links | AVAILABLE | Events can link to workflow or gig detail. |
| Calendar | Google Calendar sync | PLANNED | Not implemented. |
| Gigs / Work Orders | Create gig | AVAILABLE | Standalone work orders can be created without campaign/team membership. |
| Gigs / Work Orders | Assign employee/freelancer | AVAILABLE | Assignee and reviewer membership fields exist. |
| Gigs / Work Orders | Submit gig | AVAILABLE | Assignee can submit notes or external link. |
| Gigs / Work Orders | Approve/request changes | AVAILABLE | Reviewer/manager/owner actions exist. |
| Gigs / Work Orders | My Work integration | AVAILABLE | Dashboard includes work orders for direct assignee/reviewer. |
| Gigs / Work Orders | Calendar integration | AVAILABLE | Work order due dates appear as calendar events. |
| Gigs / Work Orders | Gig templates | PLANNED | Not implemented. |
| My Work / Dashboard | Owner dashboard | AVAILABLE | Agency metrics and queues exist. Some metrics are still broad approximations. |
| My Work / Dashboard | Employee My Work | AVAILABLE | Production roles see My Work label and assigned work. |
| My Work / Dashboard | Role-specific dashboards | PARTIALLY AVAILABLE | Backend filters by role/task, but copy and widgets are still generic. |
| Notifications | In-app notification records | PARTIALLY AVAILABLE | Notification service creates records from selected flows. No complete notification center route found. |
| Notifications | Unread/read management | NOT FOUND | No owner-facing notification center found in current frontend. |
| Notifications | Email/WhatsApp delivery | PLANNED | Delivery models exist; product delivery is not implemented. |
| Activity / Audit | Outbox events | AVAILABLE | Writes emit domain events through outbox/event bus in many modules. |
| Activity / Audit | Campaign activity | AVAILABLE | Campaign page activity tab exists. |
| Activity / Audit | Global audit viewer | NOT FOUND | Internal event/audit data exists; no general UI found. |
| Files | External file links | AVAILABLE | Backend stores Google Drive/Frame.io-style links and metadata. |
| Files | Media upload/storage | PLANNED | V1 intentionally avoids hosting media files. |
| Settings | Profile | AVAILABLE | Profile settings route exists. |
| Settings | Status | AVAILABLE | Status settings route exists. |
| Settings | Appearance | AVAILABLE | Theme route exists. |
| Settings | Agency | PARTIALLY AVAILABLE | Route exists for owners, but settings remain minimal. |

## Core User Journeys

### I just created my agency

Status: `AVAILABLE`

Owner logs in with Google, creates an agency, receives Owner role, lands in the active workspace, then can invite team members, create clients, and start campaigns or gigs.

Limitations: agency settings are minimal; there is no guided onboarding checklist in the help system yet.

### I signed a new client

Status: `AVAILABLE`

Owner/manager creates a client, fills the playbook, adds relationship context, then creates either a campaign for structured production or a gig for one-off work.

Limitations: standalone `ClientContact` backend exists, but owner-facing contacts UI is not complete.

### Client wants 8 reels per week

Status: `AVAILABLE`

Owner/manager creates a campaign, adds deliverables and publishing slots, then generates production from publishing slots. AGENCIE creates content and workflow work from the publishing commitment.

Limitations: recurring automation is partial; owners may still create or adjust slots manually.

### I just need 5 scripts by Friday

Status: `AVAILABLE`

Owner/manager creates a gig, selects client if relevant, assigns an assignee and reviewer, sets due date, and the assignee sees it in My Work and Calendar.

Limitations: no gig templates, payments, or freelancer portal yet.

### I need to add an employee

Status: `AVAILABLE`

Owner/manager invites an email, selects one or more roles, and the member gets agency access after verified login or invitation acceptance.

Limitations: actual email delivery is not implemented; invitation token handling exists.

### One employee works for multiple agencies

Status: `AVAILABLE`

One user can have memberships in many agencies and switch workspace from the profile menu.

### I need to review submitted work

Status: `AVAILABLE`

Manager/owner opens the workflow item, reviews the latest submitted link/notes, then approves, requests changes, accepts handover, or rejects handover depending on stage.

Limitations: review UI is present, but a rich chronological review history experience is still partial.

### I need to publish content

Status: `AVAILABLE`

Publishing schedule slots show planned/ready/missed/published states. A slot can be marked published with URL/time. Workflow completion can update publishing readiness.

Limitations: no direct social-platform publishing or Google Calendar sync.

## Role Capability Matrix

| Role | Main Screens | Can Manage | Main Limits |
| --- | --- | --- | --- |
| Owner | Dashboard, Clients, Campaigns, Gigs, Content, Workflow, Calendar, Team | Agency setup, team, roles, clients, campaigns, workflow, publishing, gigs | None expected in MVP except unavailable future modules. |
| Admin | Same as Owner in navigation | Broad operational access | Admin role exists; owner-specific business rules may still apply in places. |
| Manager | Dashboard, Campaigns, Gigs, Workflow, Calendar, Team | Campaigns, reviews, workflow operations, gigs, team visibility | No owner-only agency settings/removal edge cases. |
| Writer | My Work, Campaigns, Gigs, Workflow, Calendar | Own writing submissions and assigned gigs | No team/client/admin controls. |
| DOP | My Work, Campaigns, Gigs, Workflow, Calendar | Own shoot/handover submissions and assigned gigs | No campaign management unless role elevated. |
| Editor | My Work, Campaigns, Gigs, Workflow, Calendar | Intake, edit submissions, assigned gigs | No team/client/admin controls. |
| Designer | My Work, Campaigns, Gigs, Workflow, Calendar | Assigned design/gig work | Dedicated design workflow is still mostly represented through generic workflow/gig stages. |
| Social Media Manager | Dashboard/My Work, Campaigns, Gigs, Calendar | Publishing-related calendar visibility and gigs | Dedicated publishing workspace is not implemented. |
| Finance | Dashboard, Clients | Limited client/business visibility | Billing/invoices are not implemented. |
| HR | Dashboard, Team | Team visibility | Attendance/leave are not implemented. |
| Client | Dashboard, Campaigns, Calendar | Planned external client review portal | Full client portal is not implemented. |
| Member | Dashboard/My Work, Campaigns, Gigs, Workflow, Calendar | Basic assigned work | Generic fallback role. |

## Known Limitations

- No full notification center UI with read/unread management was found.
- Email, WhatsApp, Google Calendar, and social publishing integrations are planned, not available.
- Client contacts are backend-ready but not fully integrated into owner-facing client pages.
- Workflow history exists as data but is not consistently presented as a polished timeline on every relevant screen.
- Owner/manager dashboard metrics are useful but still partly broad approximations.
- Campaign and client forms are functional but still heavier than a WhatsApp-style assignment flow.
- Some documentation files are implementation plans and can describe future intent rather than current behavior.
- A development-only role testing override exists and must remain disabled outside development.

## Help Center Information Architecture

Recommended public help structure:

- Getting Started
  - What is AGENCIE?
  - Create your agency
  - Add your team
  - Add your first client
  - Run your first piece of content
- Daily Operations
  - My Work
  - Workflow
  - Calendar
  - Reviews and approvals
  - Blockers
  - Notifications
- Clients
  - Create a client
  - Client playbook
  - Contacts
  - Client access
- Campaigns
  - Campaign planning
  - Deliverables
  - Team
  - Publishing schedule
  - Generate production
- Gigs
  - When to use gigs
  - Create a gig
  - Submit gig work
  - Review gig work
- Team and Access
  - Invite employees
  - Roles
  - Multiple roles
  - Multiple agencies
  - Workspace switching
- Settings
  - Profile
  - Agency
  - Appearance
  - Status
- Troubleshooting
  - I cannot see a workspace
  - A task is not showing
  - Calendar does not match My Work
  - Invitation already accepted
  - Permission denied
  - Wrong agency selected

## Documentation Source Strategy

- Store owner-facing docs as Markdown under `frontend/content/docs`.
- Use frontmatter for title, description, category, order, roles, and status.
- Render Markdown in a lightweight Next.js route without adding a CMS or database.
- Keep search client-side over document metadata and plain text.
- Use `status` badges so partial/planned articles are clearly labeled.

## Search Strategy

V1 search can be local and static:

1. Load the docs index from source-controlled files at build time.
2. Search title, description, category, roles, status, and body text.
3. Show matching article links in the sidebar.

No external search service is needed.

## Files To Create Or Modify

Planned:

- `frontend/content/docs/**.md`
- `frontend/src/lib/docs.ts`
- `frontend/src/components/help/HelpSearch.tsx`
- `frontend/src/components/help/MarkdownContent.tsx`
- `frontend/src/app/help/[[...slug]]/page.tsx`
- `frontend/src/app/help/layout.tsx` if needed
- `frontend/src/components/WorkspaceHeader.tsx`

Optional contextual links:

- Campaign detail/new pages
- Workflow board/detail pages
- Calendar page
- Gigs pages
- Team page

## Implementation Plan

1. Create Markdown source files for the minimum complete help structure.
2. Build a lightweight docs loader that parses frontmatter and article bodies.
3. Build a global `/help` route with sidebar navigation, search, breadcrumbs, status badges, and previous/next links.
4. Add callout rendering for Important, Tip, Warning, Role required, and Not available yet.
5. Link Help & Support in the profile menu to `/help`.
6. Add simple contextual help links from the highest-value screens.
7. Build frontend and verify the docs route renders without changing business logic.
