# Event Catalog

Date: July 20, 2026

## Purpose

This document defines the domain events Agency OS should use as the system grows.

Rule:

> Services and modules react to events, not database changes.

Every important state change should publish one domain event with a stable payload.

## Event Envelope

All events should use this envelope:

```json
{
  "eventId": "uuid-or-nanoid",
  "eventType": "ContentAssigned",
  "eventVersion": 1,
  "agencyId": "uuid",
  "actorId": "membership-id-or-null",
  "occurredAt": "2026-07-20T10:00:00.000Z",
  "correlationId": "request-or-flow-id",
  "requestId": "http-request-id",
  "payload": {}
}
```

## Rules

- Events are append-only facts.
- Events use past-tense names.
- Consumers must be idempotent.
- Payloads should contain IDs and essential snapshot fields, not large documents.
- Event versions must increase when payload shape changes.
- Events should be emitted by the module that owns the state change.

## Catalog

| Event | Publisher | Consumers | Payload |
|---|---|---|---|
| `AgencyCreated` | Organization | Audit, Notification | `agencyId`, `name`, `slug` |
| `UserRegistered` | Auth | User, Audit | `authUserId`, `emailHash`, `name` |
| `MemberInvited` | Organization | Notification, Audit | `membershipId`, `roleId`, `invitedEmailHash` |
| `UserJoinedAgency` | User | Audit | `userId`, `membershipId`, `agencyId` |
| `RoleChanged` | Organization | Audit, WebSocket | `membershipId`, `oldRoleId`, `newRoleId` |
| `ManagerAssigned` | Organization | Audit, Notification | `clientId`, `managerMembershipId` |
| `ClientCreated` | Client | Audit | `clientId`, `name`, `industry` |
| `ClientUpdated` | Client | Audit, WebSocket | `clientId`, `changedFields` |
| `CampaignCreated` | Campaign | Audit, WebSocket | `campaignId`, `clientId`, `name` |
| `CampaignArchived` | Campaign | Audit, WebSocket | `campaignId`, `clientId` |
| `ContentAssetCreated` | Workflow | Audit, WebSocket | `contentAssetId`, `displayCode`, `type` |
| `ContentAssigned` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `assigneeId`, `stage`, `deadlineAt` |
| `WorkflowStageChanged` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `fromStage`, `toStage` |
| `SubmissionCreated` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `submissionId`, `version` |
| `SubmissionViewed` | Workflow | Audit, WebSocket | `submissionId`, `viewerId`, `seenAt` |
| `SubmissionRecalled` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `submissionId` |
| `SubmissionAccepted` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `submissionId` |
| `SubmissionRejected` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `submissionId`, `reason` |
| `ApprovalGranted` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `approvalId` |
| `ApprovalRejected` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `approvalId`, `reason` |
| `ChangesRequested` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `approvalId`, `returnToOwnerId` |
| `BlockerRaised` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `blockerId`, `reason` |
| `BlockerResolved` | Workflow | Notification, Audit, WebSocket | `contentAssetId`, `blockerId` |
| `DeadlineMissed` | Workflow Worker | Notification, Audit, WebSocket | `contentAssetId`, `ownerMembershipId`, `deadlineAt` |
| `NotificationQueued` | Notification | Audit | `notificationId`, `channels` |
| `NotificationSent` | Notification | Audit | `notificationId`, `deliveryId`, `channel` |
| `NotificationFailed` | Notification | Audit | `notificationId`, `deliveryId`, `channel`, `retryCount` |
| `WebhookReceived` | Gateway | Audit, Worker | `webhookEventId`, `provider`, `eventType` |

## MVP Priority Events

The first production-ready implementation should prioritize:

```text
AgencyCreated
UserRegistered
ClientCreated
CampaignCreated
ContentAssetCreated
ContentAssigned
SubmissionCreated
SubmissionRecalled
ApprovalGranted
ChangesRequested
BlockerRaised
BlockerResolved
DeadlineMissed
NotificationQueued
WebhookReceived
```

