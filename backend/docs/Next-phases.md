AGOS Implementation Plan: Workflow Detail Drawer + Actions

Status

Next Vertical Slice

Goal

Turn the existing workflow board from a read-only visualization into an operational workspace where agency members can assign, submit, review, approve, return, block, and advance creative work.

The workflow engine already exists in the backend. This phase should expose that capability through a role-aware frontend without duplicating workflow rules in React.

⸻

User Outcome

At the end of this phase:

Founder / Manager
        ↓
Opens Workflow Board
        ↓
Selects Content Asset
        ↓
Views complete workflow context
        ↓
Assigns work
        ↓
Employee submits work
        ↓
Reviewer approves or requests changes
        ↓
Workflow advances
        ↓
Board, dashboard and history update

This is the first frontend slice where AGOS becomes an actual operating system rather than a respectable collection of forms. Humanity has endured enough CRUD pages pretending to be products.

⸻

Core Principles

* Workflow remains the source of truth.
* Backend owns transition and authorization rules.
* Frontend only renders actions currently allowed.
* All reads and writes remain tenant-scoped.
* Existing workflow APIs and services must be reused.
* Every successful mutation refreshes all affected views.
* Files, submissions, approvals, blockers and history belong inside workflow context.
* Do not introduce drag-and-drop stage movement yet.
* Complete one vertical slice before starting notifications or calendar integration.

⸻

Scope

Included

* Workflow detail drawer
* Role-aware available actions
* Assign owner
* Advance stage
* Submit work
* Recall submission
* Mark submission as seen
* Approve work
* Request changes
* Block work
* Unblock work
* Attach external file links
* Unified workflow activity timeline
* Query invalidation and board synchronization
* Loading, empty and error states
* Backend and frontend tests
* Swagger and API documentation updates

Out of Scope

* Custom workflow builder
* Free-form drag-and-drop
* Email or WhatsApp notifications
* Google Calendar synchronization
* Comments or chat
* Direct file uploads
* Version comparison UI
* Client portal
* Mobile optimization
* Real-time collaborative editing

⸻

Existing Backend APIs to Reuse

POST /api/v1/content-assets/:id/advance-stage
POST /api/v1/content-assets/:id/assign
POST /api/v1/content-assets/:id/submit
POST /api/v1/content-assets/:id/recall-submission
POST /api/v1/content-assets/:id/submissions/:submissionId/seen
POST /api/v1/content-assets/:id/approve
POST /api/v1/content-assets/:id/request-changes
POST /api/v1/content-assets/:id/block
POST /api/v1/content-assets/:id/unblock
POST /api/v1/files/external-links

Before adding replacements, inspect these endpoints and their current response shapes. Extend existing modules rather than creating parallel workflow APIs with slightly different names, because apparently duplicate business logic enjoys reproducing when unsupervised.

⸻

Phase 1: Workflow Detail Read Model

Problem

The current frontend has enough information to list workflow cards but not enough to operate one content item without making many separate requests.

Backend

Add or confirm:

GET /api/v1/workflow/:workflowInstanceId

Alternatively, retain content-centric routing if that matches the existing codebase:

GET /api/v1/content-assets/:contentAssetId/workflow

Choose one convention and use it consistently.

Response Shape

{
  "workflow": {
    "id": "workflow-instance-uuid",
    "status": "ACTIVE",
    "currentStage": "WRITING",
    "currentStepId": "workflow-step-uuid",
    "deadlineAt": "2026-08-04T18:00:00.000Z",
    "riskStatus": "AT_RISK",
    "version": 3
  },
  "contentAsset": {
    "id": "content-asset-uuid",
    "displayCode": "REEL-021",
    "type": "REEL",
    "title": "Air Max Launch",
    "brief": "Create the product launch reel."
  },
  "client": {
    "id": "client-uuid",
    "name": "Nike India"
  },
  "campaign": {
    "id": "campaign-uuid",
    "name": "August Product Launch"
  },
  "currentTask": {
    "id": "workflow-task-uuid",
    "title": "Write launch script",
    "status": "IN_PROGRESS",
    "stage": "WRITING",
    "deadlineAt": "2026-08-04T18:00:00.000Z",
    "version": 2,
    "owner": {
      "membershipId": "membership-uuid",
      "name": "Rahul",
      "role": "WRITER",
      "avatarUrl": null
    }
  },
  "manager": {
    "membershipId": "membership-uuid",
    "name": "Priya"
  },
  "submissions": [],
  "approvals": [],
  "blockers": [],
  "files": [],
  "assignmentHistory": [],
  "transitions": []
}

Repository Work

Add focused queries for:

findWorkflowDetail()
findCurrentTask()
findSubmissions()
findApprovals()
findActiveBlockers()
findFiles()
findAssignmentHistory()
findTransitions()

Use one transaction or efficient grouped reads where appropriate. Do not create an N+1 carnival.

Security

* Resolve agency from the security context.
* Verify the workflow belongs to the current agency.
* Filter sensitive data based on permissions.
* Never trust agencyId, actorId, or membership identity from the client where the authenticated context can provide it.

⸻

Phase 2: Available Actions Projection

Goal

The frontend should not recreate workflow rules.

Add:

GET /api/v1/workflow/:workflowInstanceId/actions

Or include availableActions in the workflow detail response if that keeps the read model simpler.

Response Example

{
  "availableActions": [
    {
      "key": "ASSIGN",
      "enabled": true,
      "requires": ["assigneeId", "deadlineAt"]
    },
    {
      "key": "SUBMIT",
      "enabled": false,
      "reason": "Only the current task owner can submit"
    },
    {
      "key": "BLOCK",
      "enabled": true,
      "requires": ["reason"]
    }
  ]
}

Action Keys

ASSIGN
ADVANCE_STAGE
SUBMIT
RECALL_SUBMISSION
MARK_SEEN
APPROVE
REQUEST_CHANGES
BLOCK
UNBLOCK
ATTACH_LINK

Backend Evaluation Rules

Evaluate using:

* authenticated membership
* permissions
* current task ownership
* current workflow stage
* current task status
* active blockers
* active submission state
* allowed transition rules
* workflow instance status

The service should call existing domain rules instead of adding a second permission engine merely because one engine was apparently too peaceful.

⸻

Phase 3: Frontend Workflow Detail Drawer

Trigger

Clicking a workflow card opens the drawer.

Recommended Layout

┌─────────────────────────────────────────────┐
│ REEL-021                         [Close]     │
│ Air Max Launch                              │
│ Nike India • August Product Launch          │
├─────────────────────────────────────────────┤
│ Stage      Owner       Deadline      Risk   │
│ WRITING    Rahul       Today 6 PM     AT RISK│
├─────────────────────────────────────────────┤
│ [Overview] [Work] [Files] [History]         │
├─────────────────────────────────────────────┤
│ Contextual content                          │
├─────────────────────────────────────────────┤
│ Valid workflow actions                      │
└─────────────────────────────────────────────┘

Drawer Tabs

Overview

Show:

* content asset
* client
* campaign
* current stage
* task status
* owner
* manager
* production deadline
* future publish date if available
* risk status
* active blocker
* brief

Work

Show:

* current task
* submission state
* latest submission
* approval status
* changes requested
* relevant action forms

Files

Show:

* scripts
* raw footage
* draft cuts
* final cuts
* thumbnails
* reference links
* published links

History

Show one merged chronological activity feed from:

* workflow transitions
* assignment history
* submissions
* approvals
* blockers
* file attachments
* audit events where relevant

⸻

Phase 4: Action Forms

Each action should use a dedicated dialog or drawer section.

Assign Owner

Fields:

Assignee
Workflow step
Deadline
Reason

Rules:

* Show only active memberships in the current agency.
* Prefer members whose role matches the workflow step.
* Allow override only with permission.
* Do not expose raw actor ID fields.

Mutation:

POST /content-assets/:id/assign

After success:

Refresh workflow detail
Refresh workflow board
Refresh dashboard
Refresh activity

⸻

Advance Stage

Fields:

Next stage
Reason
Next owner, when required
Next deadline, when required

Only display backend-approved transitions.

Mutation:

POST /content-assets/:id/advance-stage

⸻

Submit Work

Fields:

Submission type
Body / note
Optional external link

Submission type dropdown:

SCRIPT
RAW_FOOTAGE
FINAL_CUT
THUMBNAIL
CAPTION
PUBLISHED_LINK
OTHER

Mutation:

POST /content-assets/:id/submit

Only the current task owner or explicitly permitted role can submit.

⸻

Recall Submission

Show only when:

* submission is active
* user is the submitter
* submission has not passed a non-recallable state

Require confirmation.

Mutation:

POST /content-assets/:id/recall-submission

⸻

Mark Submission Seen

This can be triggered when an authorized reviewer opens an unseen submission.

Mutation:

POST /content-assets/:id/submissions/:submissionId/seen

Avoid repeated calls by checking seenAt.

⸻

Approve Work

Fields:

Comment
Next stage
Next owner
Next workflow step
Next deadline

Generate a unique idempotency key on the client.

Mutation:

POST /content-assets/:id/approve

⸻

Request Changes

Fields:

Comment
Return stage
Return owner
Return workflow step

Mutation:

POST /content-assets/:id/request-changes

The form must require a useful comment. “Fix it” is not feedback. It is merely hostility with fewer syllables.

⸻

Block Work

Fields:

Reason
Details

Reason should use common dropdown values:

WAITING_FOR_CLIENT
MISSING_ASSETS
MISSING_APPROVAL
TECHNICAL_ISSUE
RESOURCE_UNAVAILABLE
SCHEDULE_CONFLICT
SCOPE_CLARIFICATION
OTHER

Show a text field when OTHER is selected.

Mutation:

POST /content-assets/:id/block

⸻

Unblock Work

Require confirmation and optionally a resolution note if supported.

Mutation:

POST /content-assets/:id/unblock

⸻

Phase 5: File External Links

Frontend

Add file-link form under the Files tab.

Fields:

Link type
Title
External URL
Optional note

Link type dropdown:

SCRIPT
REFERENCE
RAW_FOOTAGE
DRAFT_CUT
FINAL_CUT
THUMBNAIL
BRAND_ASSET
DRIVE_FOLDER
PUBLISHED_LINK
OTHER

Backend

Reuse:

POST /api/v1/files/external-links

Confirm it supports associations with:

* agency
* content asset
* workflow task where needed
* uploader membership
* storage provider
* file type

Validation

* Require HTTPS in production.
* Validate supported providers where practical.
* Do not fetch or inspect arbitrary URLs synchronously.
* Audit attachment creation.

⸻

Phase 6: Unified Activity Timeline

Backend

Add or confirm:

GET /api/v1/workflow/:workflowInstanceId/activity

The response should merge domain history into a single sorted projection.

{
  "items": [
    {
      "id": "event-uuid",
      "type": "TASK_ASSIGNED",
      "createdAt": "2026-08-01T10:12:00.000Z",
      "actor": {
        "membershipId": "uuid",
        "name": "Priya"
      },
      "summary": "Assigned Rahul as Writer",
      "metadata": {
        "fromMembershipId": null,
        "toMembershipId": "uuid"
      }
    }
  ]
}

Supported Timeline Events

WORKFLOW_STARTED
STAGE_ADVANCED
TASK_ASSIGNED
TASK_REASSIGNED
SUBMISSION_CREATED
SUBMISSION_RECALLED
SUBMISSION_SEEN
WORK_APPROVED
CHANGES_REQUESTED
WORK_BLOCKED
WORK_UNBLOCKED
FILE_ATTACHED
WORKFLOW_COMPLETED

The frontend should render known event types with icons and readable summaries. Unknown types should gracefully fall back to the server-provided summary.

⸻

Phase 7: Permission-Driven UI

Frontend Utility

Create:

can(permission: PermissionKey): boolean

And a reusable component:

<Can permission="WORKFLOW_APPROVE">
  <ApproveButton />
</Can>

However, available actions returned by the backend remain authoritative.

The frontend permission utility is for navigation and presentation, not security enforcement.

Avoid

if (role === "OWNER")

throughout the UI.

Use permissions such as:

WORKFLOW_VIEW_ALL
WORKFLOW_ASSIGN
WORKFLOW_ADVANCE
WORKFLOW_SUBMIT
WORKFLOW_REVIEW
WORKFLOW_APPROVE
WORKFLOW_REQUEST_CHANGES
WORKFLOW_BLOCK
WORKFLOW_UNBLOCK
WORKFLOW_FILES_ATTACH

⸻

Phase 8: State Synchronization

Use a consistent query-key structure.

workflowKeys.board(filters)
workflowKeys.detail(workflowInstanceId)
workflowKeys.actions(workflowInstanceId)
workflowKeys.activity(workflowInstanceId)
dashboardKeys.summary()
activationKeys.current()
notificationKeys.list()

After mutations, invalidate only affected queries.

At minimum:

Workflow board
Workflow detail
Available actions
Workflow activity
Founder dashboard
Activation state, when workflow is first started

Use optimistic updates only for low-risk presentation changes. Workflow transitions should wait for confirmed backend success because pretending a stage changed before the engine accepts it is how interfaces begin lying again.

⸻

Recommended Frontend Structure

src/
├── features/
│   └── workflow/
│       ├── api/
│       │   ├── get-workflow-detail.ts
│       │   ├── get-workflow-actions.ts
│       │   ├── get-workflow-activity.ts
│       │   └── workflow-mutations.ts
│       ├── components/
│       │   ├── workflow-detail-drawer.tsx
│       │   ├── workflow-overview-tab.tsx
│       │   ├── workflow-work-tab.tsx
│       │   ├── workflow-files-tab.tsx
│       │   ├── workflow-history-tab.tsx
│       │   ├── workflow-action-bar.tsx
│       │   ├── workflow-timeline.tsx
│       │   └── forms/
│       │       ├── assign-form.tsx
│       │       ├── advance-stage-form.tsx
│       │       ├── submit-work-form.tsx
│       │       ├── approve-form.tsx
│       │       ├── request-changes-form.tsx
│       │       ├── block-form.tsx
│       │       └── attach-link-form.tsx
│       ├── hooks/
│       ├── types/
│       └── workflow-keys.ts

Adapt this to the existing project organization instead of forcing a new folder convention merely for decorative consistency.

⸻

Recommended Backend Structure

Extend the existing Workflow module.

modules/workflow/
├── controllers/
│   └── workflow-query.controller.ts
├── services/
│   ├── workflow-query.service.ts
│   ├── workflow-action-policy.service.ts
│   └── workflow-activity.service.ts
├── repositories/
│   └── workflow-query.repository.ts
├── dto/
│   ├── workflow-detail-response.dto.ts
│   ├── workflow-actions-response.dto.ts
│   └── workflow-activity-response.dto.ts

Do not split into new deployable services.

The existing architecture is sufficient.

⸻

Testing Plan

Backend Unit Tests

Test action availability for:

* owner
* manager
* current task owner
* unrelated employee
* blocked task
* submitted task
* completed workflow
* invalid transition
* cross-agency workflow

Test read projections:

* detail includes all relevant records
* active blocker correctly represented
* histories sorted correctly
* sensitive fields filtered by permission

Backend Integration Tests

Test complete flows:

Assign → Submit → Seen → Approve → Advance
Assign → Submit → Request Changes → Resubmit → Approve
Assign → Block → Unblock → Submit
Submit → Recall

Also test:

* wrong tenant
* inactive membership
* missing permission
* duplicate approval idempotency key
* stale optimistic-lock version

Frontend Tests

Test:

* drawer opens from board card
* correct tabs render
* role-specific actions appear
* disabled actions show reasons where appropriate
* action forms validate inputs
* successful mutation refreshes detail and board
* API failure preserves existing UI state
* history renders chronologically
* files appear after attaching a link

Manual Acceptance Test

Use at least three accounts:

Owner
Writer
Manager

Run:

Owner assigns Writer
Writer logs in and submits
Manager marks submission seen
Manager requests changes
Writer resubmits
Manager approves
Workflow advances
Owner sees updated board and timeline

⸻

Execution Order

Slice 1

Workflow detail read model and drawer shell.

Slice 2

Available-actions projection and action bar.

Slice 3

Assign, submit and block/unblock.

Slice 4

Seen, approve and request changes.

Slice 5

Recall and advance stage.

Slice 6

External links and Files tab.

Slice 7

Unified activity timeline.

Slice 8

Polish, integration testing and documentation.

Complete and verify each slice before moving to the next. Kanban means one active slice, not eight browser tabs labeled “almost done.”

⸻

Definition of Done

* Workflow card opens a detailed operational drawer.
* Current stage, owner, deadline, risk and blocker state are accurate.
* Backend returns valid actions for the authenticated membership.
* Founder or manager can assign work.
* Current owner can submit and recall eligible work.
* Reviewer can mark seen, approve or request changes.
* Authorized users can block and unblock work.
* Valid stage transitions can be completed.
* External links can be attached and viewed.
* All operations appear in one chronological history.
* Board and dashboard synchronize after every action.
* Cross-tenant access is rejected.
* Permissions are enforced in the backend.
* Swagger and API docs are updated.
* Backend and frontend tests pass.
* Builds pass.
* No workflow rules are duplicated in React.
* No unrelated infrastructure refactor is introduced.

Codex Execution Instruction

Implement this plan as incremental vertical slices.
Before changing code:
1. Inspect the existing workflow, file, security, event, audit and frontend API-client implementations.
2. Reuse existing endpoints and services wherever possible.
3. Identify any differences between this plan and the current codebase.
4. Present a concise implementation checklist.
5. Implement only the first incomplete slice.
6. Run relevant tests and builds.
7. Report changed files, validation results and remaining work.
Do not rewrite the workflow engine.
Do not introduce a new architectural pattern.
Do not implement notifications, calendar sync, comments, mobile layouts or drag-and-drop.
Keep workflow policy authoritative in the backend.
Follow AGENT_CONTEXT.md, project documentation, Lean principles, Kanban WIP limits and the existing vertical-slice architecture.
