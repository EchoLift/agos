# Publishing Schedule Agenda - 2026-07-31

## Goal

Make Campaign Calendar operational before building richer visual calendar views.

The campaign now owns publishing slots as planned release moments, while content assets and workflow instances continue to own production readiness.

## Domain Rules

- A publishing slot belongs to one agency and one campaign.
- A publishing slot may optionally link to one content asset.
- One content asset may have multiple publishing slots across platforms.
- When a linked publishing slot is marked published, the linked content asset becomes `PUBLISHED`.
- When a linked publishing slot is marked published, any active workflow instance for that content asset is completed.
- Parent pages must derive metrics from child records instead of storing duplicate counters.
- `scheduledAt` must fall inside the campaign start and end window.
- Cancelled slots cannot be marked published.
- Published slots cannot be edited through normal update.
- Mutating commands use optimistic locking through `version`.
- Expired `PLANNED`, `READY`, or `SCHEDULED` slots are marked `MISSED` when agenda data is read.

## Slot Fields

- `platform`
- `scheduledAt`
- `timezone`
- `status`
- `riskStatus`
- `contentAssetId`
- `caption`
- `note`
- `cancellationReason`
- `publishedUrl`
- `publishedAt`
- `version`

## Lifecycle

Primary path:

```text
PLANNED -> READY -> SCHEDULED -> PUBLISHED
```

Alternative exits:

```text
PLANNED / READY / SCHEDULED -> CANCELLED
PLANNED / READY / SCHEDULED -> MISSED
```

Status is the business state. Risk is the operational warning.

Example:

```text
status: SCHEDULED
riskStatus: AT_RISK
readiness: IN_PRODUCTION
```

## Hierarchy Sync

Publishing updates flow upward through the hierarchy:

```text
PublishingSchedule
  -> ContentAsset
  -> WorkflowInstance
  -> Campaign metrics
  -> Client / Dashboard read models
```

The campaign page now refetches the campaign after publishing changes so the content count, completed count, pending count, content tab, and calendar tab remain in sync.

The backend remains the source of truth:

- `PublishingSchedule.status = PUBLISHED`
- linked `ContentAsset.status = PUBLISHED`
- linked active `WorkflowInstance.status = COMPLETED`
- `ContentAssetPublished` and `PublishingSlotPublished` are written through the outbox in the same transaction

## API

- `GET /api/v1/campaigns/:id/publishing-schedules`
- `POST /api/v1/campaigns/:id/publishing-schedules`
- `PATCH /api/v1/campaigns/:id/publishing-schedules/:scheduleId`
- `POST /api/v1/campaigns/:id/publishing-schedules/:scheduleId/cancel`
- `POST /api/v1/campaigns/:id/publishing-schedules/:scheduleId/mark-published`

## Read Model

The agenda response returns:

- summary counts: upcoming, ready, atRisk, missed
- sorted agenda items
- linked content details
- current workflow stage/task details when available
- current owner when available
- backend-derived readiness and risk

Readiness values:

- `UNLINKED`
- `NOT_STARTED`
- `IN_PRODUCTION`
- `WAITING_APPROVAL`
- `READY`
- `PUBLISHED`

## Permissions

Publishing schedule mutation is restricted to:

- Owner
- Manager
- Social Media Manager
- memberships with publishing permissions

Other roles can view campaign calendar context but cannot mutate slots unless permissions are expanded later.

## Frontend

Campaign detail now uses tabs:

- Overview
- Content
- Calendar
- Team
- Activity

The Calendar tab starts with an Agenda view:

- summary cards
- add publishing slot form for authorized users
- agenda cards with platform, scheduled time, status, risk, readiness, owner, and linked content
- explicit actions: reschedule, cancel, mark published

Month and week views are intentionally left for the next slice.

## Next

1. Replace prompt-based agenda actions with proper modals.
2. Add week view.
3. Add month view.
4. Add deliverable-to-content generation preview.
5. Add role-aware global calendar endpoint.
