# AGENCIE MVP Coherence Roadmap

Last updated: August 8, 2026

## Purpose

This document captures the next implementation plan after the architecture audit. AGENCIE has a strong backend spine, but the MVP risk is now coherence: Workflow, Calendar, Dashboard, My Work, Notifications, Campaign, and Activity must stop interpreting production state independently.

The next phase should not expand AGENCIE horizontally. It should make the existing production loop consistent, secure, and effortless.

## Product Principle

Workflow is the source of truth for production progress.

Every other screen is a projection:

- Workflow: operational board
- Calendar: time projection
- Dashboard: attention projection
- My Work: employee projection
- Campaign: campaign projection
- Notifications: event projection
- Activity: historical projection

A task should have one production state, one current owner, one deadline, one activity history, and one next required action.

AGENCIE now supports two entry points into work:

- **Campaign Production**: structured client campaigns, content assets, workflow tasks, and publishing schedules.
- **Gig / Work Orders**: direct one-off assignments such as scripts, edits, shoots, thumbnails, or overflow work without requiring a campaign team.

Employees should experience both through the same operational surfaces: My Work, Workflow, Calendar, Notifications, and Activity. The employee should not need to care whether the work originated from a campaign or a standalone gig.

## Non-Goals For This Phase

Do not build these until the production loop is coherent:

- Configurable workflow designer
- Google Calendar sync
- WhatsApp notifications
- Billing
- Client portal
- Advanced analytics
- Agency-custom lookup management
- AI campaign generation

## Slice 1: Unified Operational Read Model

### Goal

Create a shared backend projection layer that powers owner dashboards, employee My Work, workflow board, calendar counts, and attention queues from the same operational definitions.

### Shared Concepts

Define these once in backend code:

- Current task
- Responsible membership
- Visible-to memberships
- Effective deadline
- Operational status
- Risk status
- Submission state
- Approval state
- Next required action
- Deep link target

### Proposed Backend Shape

Create a shared projection service, not one giant endpoint.

Candidate name:

```text
OperationalProjectionService
```

Consumers:

- `GET /dashboard`
- `GET /workflow/board`
- `GET /calendar/events`
- `GET /work-orders`
- Employee My Work endpoint or dashboard projection
- Campaign detail summaries

### Definition Of Done

- My Work task count matches Workflow filtering for the same user.
- Calendar assigned count matches My Work.
- Dashboard waiting-review count matches Workflow.
- Overdue means the same thing everywhere.
- Completing a workflow action updates every view after refetch.
- Published content/publishing slots reflect consistently in Campaign, Content, Workflow, Calendar, Dashboard, and Activity.
- Work orders appear consistently in My Work and Calendar for the assigned or reviewing membership.

## Slice 2: Security Hardening

### Goal

Make permission enforcement reliable before pilot users touch the system.

### Required Work

- Remove or disable workflow endpoints that accept arbitrary `actorId`.
- Use authenticated request context as the actor for mutating actions.
- Add permission metadata to every write controller.
- Keep service-level checks as defence in depth.
- Ensure role-testing overrides cannot exist in production.
- Resolve overlapping `/content-assets` controller ownership.
- Add integration tests for cross-tenant and missing-permission access.

### Definition Of Done

- Frontend hidden buttons are only UX, not security.
- Direct API calls cannot bypass role restrictions.
- Users cannot mutate records outside their active agency.
- Workflow action authorization is based on current task ownership, review ownership, or explicit elevated permissions.

## Slice 3: Employee My Work

### Goal

Make the default employee homepage a task inbox, not a business dashboard.

### Role Views

Writer:

- Writing tasks
- Returned scripts
- Waiting review
- Due today

Editor:

- Footage to validate
- Editing tasks
- Revisions
- Waiting approval

DOP:

- Upcoming shoots
- Footage handovers
- Rejected handovers

Social Media Manager:

- Publishing today
- Ready to publish
- Missed publishing
- At-risk publishing

### Definition Of Done

- My Work only shows work assigned to the current membership or review work the current membership can actually perform.
- Multi-role users see a merged work queue for their active roles without exposing unrelated admin pages.
- My Work, Workflow, and Calendar agree on the same assigned items.
- Standalone work orders and campaign workflow tasks appear in one unified queue.

## Slice 4: Notification Centre

### Goal

Make in-app notifications reliable before adding email, WhatsApp, or Google Calendar sync.

### V1 Scope

- List notifications.
- Unread count.
- Mark one notification as read.
- Mark all as read.
- Deep link to workflow, campaign, content, or calendar item.
- Generate notifications for all meaningful workflow actions.

### Events That Must Notify

- Task assigned
- Deadline approaching
- Submission received
- Changes requested
- Approved
- Rejected
- Workflow advanced
- Work order assigned
- Work order submitted
- Work order changes requested
- Work order approved
- Publishing today
- Overdue
- Blocker raised
- Blocker resolved

## Slice 5: Workflow History

### Goal

Render one chronological timeline for each content asset/workflow instance.

### Timeline Sources

- Workflow transitions
- Assignment history
- Submissions
- Submission views
- Approvals
- Rejections / change requests
- Blockers
- External file links
- Publishing status changes

### Example Timeline

```text
Writer assigned
Script submitted
Manager requested changes
Script resubmitted
Script approved
DOP assigned
Footage submitted
Editor rejected handover
DOP resubmitted footage
Editor accepted handover
Edit submitted
Manager approved edit
Ready to publish
Published
```

## MVP Readiness Target

AGENCIE is MVP-ready when one real agency can:

1. Create a lightweight client.
2. Create or duplicate a campaign.
3. Plan publishing slots.
4. Generate production work.
5. Assign team members.
6. Let each employee see only their work.
7. Submit, review, reject, approve, and hand off work.
8. See matching state across Workflow, Calendar, Dashboard, and My Work.
9. Receive in-app notifications with deep links.
10. Trace exactly what happened.

## Current Readiness Estimate

| Area | Current | MVP Target |
| --- | ---: | ---: |
| Domain foundation | 85% | 90% |
| Production workflow | 75% | 90% |
| Owner experience | 65% | 85% |
| Employee experience | 45% | 85% |
| State synchronization | 50% | 95% |
| Permissions/security | 50% | 90% |
| Notifications | 25% | 70% |
| Setup simplicity | 40% | 75% |

## Implementation Order

1. Unified Operational Read Model
2. Security Hardening
3. Employee My Work
4. Notification Centre
5. Workflow History

## API Documentation Sync Notes

Checked against controllers on August 1, 2026.

`backend/docs/api.md` is partially synchronized but stale in important places.

### Missing Or Incomplete In `api.md`

- `GET /activation`
- `GET /dashboard`
- `GET /workflow/board`
- `POST /content-assets/:id/actions`
- `GET /users/:id`
- `GET /me/profile`
- `PATCH /me/profile`
- `PATCH /me/status`
- `DELETE /me/status`
- `POST /files/external-links`
- `POST /organizations/:agencyId/activate`
- `PATCH /organizations/:agencyId/members/:membershipId/role`
- `DELETE /organizations/:agencyId/members/:membershipId`
- `GET /campaigns/:id/team`
- `GET /campaigns/:id/activity`
- `POST /campaigns/:id/team`
- `PATCH /campaigns/:id/team/:assignmentId`
- `DELETE /campaigns/:id/team/:assignmentId`
- `POST /campaigns/:id/activate`
- `POST /campaigns/:id/pause`
- `POST /campaigns/:id/resume`
- `POST /campaigns/:id/complete`
- `POST /campaigns/:id/publishing-schedules/:scheduleId/generate-production` is documented, but appears under the calendar section and uses `:campaignId` while the controller uses `:id`.

### Stale Or Risky Contract Details

- Workflow examples still show client-supplied `actorId`. This conflicts with the security hardening goal. Mutating actions should derive actor identity from authenticated request context.
- `POST /content-assets`, `GET /content-assets/:id`, and `PATCH /content-assets/:id` are owned by both the Content module and Workflow controller, creating overlapping route ownership that should be resolved or clearly documented.
- The roadmap section says `GET /dashboard` is a placeholder, but the endpoint exists and is actively used by the frontend.

## API Doc Sync Recommendation

Before the next implementation slice, update `backend/docs/api.md` from the actual controllers and mark legacy workflow endpoints separately from the newer command endpoint.

Recommended structure:

1. Global conventions
2. Auth
3. Organization and Membership
4. Profile
5. Activation
6. Dashboard
7. Clients
8. Campaigns
9. Campaign Team
10. Publishing Schedules
11. Content Assets
12. Workflow Board
13. Workflow Commands
14. Calendar
15. Notifications
16. Files
