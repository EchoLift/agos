# Gig / Work Orders

Date: August 8, 2026

## Purpose

AGOS now supports a second operating mode beside campaign production.

Campaign production is for structured monthly retainers, publishing schedules, and multi-craft workflows. Gig work is for direct assignments such as:

- Need 5 scripts by Friday.
- Edit these 8 reels tomorrow.
- Shoot product footage this weekend.
- Create 12 thumbnails this week.

The product language is **Gig**. The backend model is **WorkOrder** so the domain can expand later without tying the architecture to freelance-only language.

## Product Model

```text
Client
  ↓
Work Order
  ↓
Assignee
  ↓
Submission
  ↓
Review
  ↓
Completed / Changes Requested
```

A work order does not require:

- Campaign
- Campaign team assignment
- Publishing schedule
- Content asset
- Workflow instance

This keeps one-off work fast enough to compete with WhatsApp-style assignment.

## Implemented Backend

### Prisma

Added:

- `WorkOrder`
- `WorkOrderSubmission`
- `WorkOrderType`
- `WorkOrderPriority`
- `WorkOrderStatus`
- `WorkOrderSubmissionStatus`

Migration:

```text
prisma/migrations/20260808093000_add_work_orders
```

### API

Implemented under `/api/v1/work-orders`:

- `POST /work-orders`
- `GET /work-orders`
- `GET /work-orders/:id`
- `PATCH /work-orders/:id`
- `POST /work-orders/:id/submit`
- `POST /work-orders/:id/approve`
- `POST /work-orders/:id/request-changes`

### Business Rules

- Owner, admin, and manager can create and update work orders.
- Production roles can read only work orders where they are assignee or reviewer.
- Assignee can submit assigned work.
- Submission requires at least one of `body` or `externalLink`.
- Reviewer, owner, admin, or manager can approve or request changes.
- Requesting changes requires a review comment.
- Submitted work is versioned through `WorkOrderSubmission.version`.
- Work order writes emit domain events through the existing outbox/event pattern.

### Events

Added domain events:

- `WorkOrderCreated`
- `WorkOrderUpdated`
- `WorkOrderSubmitted`
- `WorkOrderApproved`
- `WorkOrderChangesRequested`
- `WorkOrderCancelled`

## Implemented Frontend

Added workspace routes:

- `/{agencySlug}/gigs`
- `/{agencySlug}/gigs/new`
- `/{agencySlug}/gigs/{workOrderId}`

Added navigation access:

- Owner/admin/manager: can create and manage gigs.
- Production roles: can see gigs assigned to them or reviewed by them.

Added projections:

- My Work links to gig detail when a dashboard item is backed by a work order.
- Calendar can display `WORK_ORDER` events.
- Calendar event clicks open the gig detail page.

## Current UX

Owner/manager flow:

```text
Gigs
  ↓
New Gig
  ↓
Choose client, work type, assignee, reviewer, due date
  ↓
Create
```

Assignee flow:

```text
My Work / Calendar / Gigs
  ↓
Open gig
  ↓
Submit link or notes
```

Reviewer flow:

```text
Open submitted gig
  ↓
Approve
  or
  Request changes
```

## Verification

Completed:

- `npx prisma validate`
- `npx jest modules/work-order/work-order.service.spec.ts`
- `npm run build` in backend
- `npm run build` in frontend

Known verification limitations:

- Backend lint is currently blocked by the repo's ESLint 9 configuration mismatch.
- Frontend lint still has pre-existing workflow page hook lint errors and image warnings outside this slice.

## Known Limits

This first slice intentionally does not include:

- Work order comments.
- File upload storage.
- Payment/reward settlement.
- Freelancer portal.
- Recurring gigs.
- Gig templates.
- Work order notifications beyond emitted events.
- Conversion from campaign deliverables into work orders.
- Full workflow engine reuse for complex multi-stage gigs.

## Next Recommendations

1. Add in-app notifications for work order assignment, submission, approval, and changes requested.
2. Add a small `My Gigs` filter in My Work if the queue grows.
3. Add gig templates for writer, editor, DOP, designer, and social media roles.
4. Later, allow campaign deliverables to generate work orders for overflow or freelance execution.

The key product rule remains:

> Employees should not care whether work came from a campaign or a standalone gig. My Work should show the next thing they need to finish.
