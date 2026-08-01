# Workflow State Machine Specification

Date: July 20, 2026

## Purpose

This document defines the first standard workflow for a content asset.

The business object is the `ContentAsset`.

The execution object is the `WorkflowInstance`.

## Standard Reel Workflow

```text
IDEA
  -> WRITING
  -> MANAGER_SCRIPT_REVIEW
  -> SHOOT
  -> EDITOR_INTAKE
  -> EDITING
  -> MANAGER_EDIT_REVIEW
  -> CLIENT_APPROVAL
  -> SCHEDULED
  -> PUBLISHED
```

## Stage Ownership

| Stage | Typical Owner | Output |
|---|---|---|
| `IDEA` | Manager | Brief |
| `WRITING` | Writer | Script submission |
| `MANAGER_SCRIPT_REVIEW` | Manager | Approval or changes |
| `SHOOT` | DOP | Raw footage link |
| `EDITOR_INTAKE` | Editor | Intake acceptance or rejection |
| `EDITING` | Editor | Final cut link |
| `MANAGER_EDIT_REVIEW` | Manager | Approval or changes |
| `CLIENT_APPROVAL` | Client or manager proxy | Client approval |
| `SCHEDULED` | Social media executive | Schedule confirmation |
| `PUBLISHED` | Social media executive | Published link |

## Valid Transitions

| From | To | Actor | Permission | Guard | Can Reject? | Can Recall? | Emits Event |
|---|---|---|---|---|---|---|---|
| `IDEA` | `WRITING` | Manager | `content.assign` | Brief exists, writer assigned | No | No | `ContentAssigned` |
| `WRITING` | `MANAGER_SCRIPT_REVIEW` | Writer | `submission.create_own` | Current owner submitted script | No | Yes (until seen) | `SubmissionCreated` |
| `MANAGER_SCRIPT_REVIEW` | `WRITING` | Manager | `approval.request_changes` | Manager requested changes | Yes | No | `ChangesRequested` |
| `MANAGER_SCRIPT_REVIEW` | `SHOOT` | Manager | `approval.create` | Manager approved script, DOP assigned | No | No | `ApprovalGranted`, `ContentAssigned` |
| `SHOOT` | `EDITOR_INTAKE` | DOP | `submission.create_own` | DOP submitted raw footage | No | Yes (until seen) | `SubmissionCreated` |
| `EDITOR_INTAKE` | `SHOOT` | Editor | `approval.request_changes` | Editor rejected intake | Yes | No | `ChangesRequested` |
| `EDITOR_INTAKE` | `EDITING` | Editor | `approval.create` | Editor accepted intake | No | No | `ApprovalGranted`, `ContentAssigned` |
| `EDITING` | `MANAGER_EDIT_REVIEW` | Editor | `submission.create_own` | Editor submitted final cut | No | Yes (until seen) | `SubmissionCreated` |
| `MANAGER_EDIT_REVIEW` | `EDITING` | Manager | `approval.request_changes` | Manager requested edit changes | Yes | No | `ChangesRequested` |
| `MANAGER_EDIT_REVIEW` | `CLIENT_APPROVAL` | Manager | `approval.create` | Manager approved edit | No | No | `ApprovalGranted`, `ContentAssigned` |
| `CLIENT_APPROVAL` | `EDITING` | Client/Proxy | `approval.request_changes` | Client requested changes | Yes | No | `ChangesRequested` |
| `CLIENT_APPROVAL` | `SCHEDULED` | Client/Proxy | `approval.create` | Client approved | No | No | `ApprovalGranted`, `ContentAssigned` |
| `SCHEDULED` | `PUBLISHED` | Social Exec | `submission.create_own` | Published link submitted | No | No | `SubmissionCreated` |

## Universal Guards

- Only Workflow Module may change `currentStage`.
- `fromStage` and `toStage` on `WorkflowTransition` are immutable audit snapshots computed at write time, not the source of truth for the asset's current state.
- Every active asset must have one current owner unless it is waiting for client action.
- Every assignment creates `AssignmentHistory`.
- Every stage change creates `WorkflowTransition`.
- Every due action should have a `WorkflowTask`.
- Every approval action should accept an idempotency key.
- Blocked work does not mean employee failure; it means the asset needs intervention.

## Recall Rules

A submission can be recalled only when:

- The actor submitted it.
- The submission status is `SUBMITTED`.
- `seenAt` is empty.

Once a manager or approver views the submission, recall is disabled.

## Blocked Rules

Allowed blocker reasons:

```text
Waiting for client
Waiting for assets
Need clarification
Waiting for approval
Technical issue
Other
```

When blocked:

- `ContentAsset.riskStatus = BLOCKED`
- Active blocker is created.
- Manager is notified.
- Founder is notified only after escalation rules require it.

## Overdue Rules

When `deadlineAt` passes and the task is not complete:

- Mark task/asset as `OVERDUE` or `AT_RISK`.
- Notify current owner.
- Notify manager.
- Escalate to founder later if unresolved.

No idle tracking, break tracking, or activity surveillance should be added.

