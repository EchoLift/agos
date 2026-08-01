# Workflow Actions - 2026-08-01

## Goal

Make workflow work executable for every production role instead of only visible.

The UI now sends domain commands to the workflow engine. The frontend does not directly change stages, owners, approvals, submissions, blockers, calendar state, or publishing readiness.

## Command Endpoint

`POST /api/v1/content-assets/:id/actions`

Body:

```json
{
  "action": "SUBMIT_FOR_REVIEW",
  "idempotencyKey": "SUBMIT_FOR_REVIEW:task-id:timestamp",
  "body": "Optional note",
  "externalLink": "https://drive.google.com/...",
  "comment": "Optional review comment",
  "reason": "Optional blocker or rejection reason"
}
```

Supported actions:

- `SUBMIT_FOR_REVIEW`
- `APPROVE`
- `ACCEPT_HANDOVER`
- `REQUEST_CHANGES`
- `REJECT`
- `BLOCK`
- `UNBLOCK`

## Production Flow

### Writer

`WRITING -> MANAGER_SCRIPT_REVIEW`

The current writer submits a script or script link. The workflow creates a script submission, closes the writer task, creates a manager review task, records assignment history, creates a transition, queues notifications, and writes outbox events.

### Manager Script Review

Approve:

`MANAGER_SCRIPT_REVIEW -> SHOOT`

Request changes:

`MANAGER_SCRIPT_REVIEW -> WRITING`

Approve creates the shoot task for the campaign DOP. Request changes returns the work to the latest script submitter or campaign writer.

### DOP

`SHOOT -> EDITOR_INTAKE`

The DOP submits the footage handover link. The editor receives an intake task before editing begins.

### Editor Intake

Accept handover:

`EDITOR_INTAKE -> EDITING`

Reject handover:

`EDITOR_INTAKE -> SHOOT`

This separates "footage uploaded" from "footage accepted", keeping accountability clear.

### Editor

`EDITING -> MANAGER_EDIT_REVIEW`

The editor submits a draft or final cut link. The manager receives the edit review task.

### Manager Edit Review

Approve:

`MANAGER_EDIT_REVIEW -> COMPLETED`

Request changes:

`MANAGER_EDIT_REVIEW -> EDITING`

Approve completes the workflow for this slice and marks linked publishing schedules as `READY`. Request changes returns the task to the editor.

## Events

The workflow command handler writes outbox events inside the same transaction as workflow state changes.

Events emitted by this slice:

- `SubmissionCreated`
- `SubmissionAccepted`
- `SubmissionRejected`
- `ApprovalGranted`
- `ApprovalRejected`
- `ChangesRequested`
- `ContentAssigned`
- `WorkflowStageChanged`
- Existing blocker actions continue to emit `BlockerRaised` and `BlockerResolved`

## Frontend

The Workflow board drawer and full workflow detail page now expose stage-aware controls:

- Submit script
- Submit footage handover
- Submit edit
- Accept handover
- Reject handover
- Approve
- Request changes
- Raise blocker
- Resolve blocker

After every command, the frontend reloads the workflow board or content detail from the backend source of truth.

## Boundary

The workflow engine remains the only owner of production state. Calendar, campaign, dashboard, notification, and activity views should react to workflow state and events instead of maintaining duplicate progress state.
