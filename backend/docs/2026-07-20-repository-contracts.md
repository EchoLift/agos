# Repository Contracts

Date: July 20, 2026

## Purpose

Repositories hide database details from application services.

Rule:

> Application services should ask repositories for business operations, not build ad hoc Prisma queries everywhere.

Every repository must automatically scope reads/writes by `agencyId` from request context or explicit service input.

## Global Rules

- No repository may return cross-agency data.
- No repository may expose another module's private tables.
- Mutation methods should accept `expectedVersion` where concurrent edits are possible.
- Delete methods should soft delete unless the table is explicitly immutable/technical.
- Query methods should avoid returning encrypted fields unless the caller needs decrypted values.

## Organization Repository

Owns:

```text
Agency
Membership
Role
Permission
RolePermission
```

Contract:

```ts
createAgency(input)
findAgencyById(agencyId)
findMembership(agencyId, membershipId)
findActiveMembershipByUser(agencyId, userId)
assignRole(agencyId, membershipId, roleId, expectedVersion)
assignManager(agencyId, membershipId, managerMembershipId, expectedVersion)
listPermissionsForMembership(agencyId, membershipId)
```

## Client Repository

Owns:

```text
Client
```

Contract:

```ts
createClient(input)
findClientById(agencyId, clientId)
listClientsForManager(agencyId, managerMembershipId)
assignClientManager(agencyId, clientId, managerMembershipId, expectedVersion)
archiveClient(agencyId, clientId, expectedVersion)
```

## Campaign Repository

Owns:

```text
Campaign
```

Contract:

```ts
createCampaign(input)
findCampaignById(agencyId, campaignId)
listCampaignsForClient(agencyId, clientId)
updateCampaignStrategy(agencyId, campaignId, patch, expectedVersion)
archiveCampaign(agencyId, campaignId, expectedVersion)
```

## Content Repository

Owns:

```text
ContentAsset
ContentAssetSequence
FileAsset
```

Contract:

```ts
createContentAsset(input)
generateDisplayCode(agencyId, contentType)
findContentAssetById(agencyId, contentAssetId)
updateContentBrief(agencyId, contentAssetId, patch, expectedVersion)
attachFileLink(input)
archiveContentAsset(agencyId, contentAssetId, expectedVersion)
```

Important:

- Content repository does not change workflow state.
- It only owns the business asset and file metadata.

## Workflow Repository

Owns:

```text
WorkflowTemplate
WorkflowStep
WorkflowInstance
WorkflowTask
WorkflowTransition
AssignmentHistory
Submission
Approval
Blocker
```

Contract:

```ts
createWorkflowInstance(input)
findActiveWorkflowInstance(agencyId, contentAssetId)
findTaskForContentAsset(agencyId, workflowTaskId, contentAssetId)
createTask(input)
completeTask(agencyId, workflowTaskId, expectedVersion)
assignTask(input)
createTransition(input)
createAssignmentHistory(input)
createSubmission(input)
recallSubmission(input)
createApproval(input)
raiseBlocker(input)
resolveBlockersForTask(agencyId, workflowTaskId)
```

Important:

- Workflow repository is the only repository that changes workflow execution state.
- Workflow state lives in `WorkflowInstance` and `WorkflowTask`, not `ContentAsset`.

## Notification Repository

Owns:

```text
Notification
NotificationDelivery
```

Contract:

```ts
createNotification(input)
queueDelivery(input)
markDeliverySent(agencyId, deliveryId, providerMessageId)
markDeliveryFailed(agencyId, deliveryId, error, nextRetryAt)
listUnreadForUser(agencyId, userId)
markRead(agencyId, notificationId, userId)
```

## Audit Repository

Owns:

```text
AuditEvent
```

Contract:

```ts
record(input)
listForEntity(agencyId, entityType, entityId)
listByRequestId(requestId)
```

Audit records are immutable.

## Event Repository

Owns:

```text
OutboxEvent
WebhookEvent
```

Contract:

```ts
enqueueOutboxEvent(input, tx)
claimPendingOutboxEvents(limit)
markOutboxPublished(eventId)
markOutboxFailed(eventId, error, nextRetryAt)
recordWebhook(input)
claimWebhookForProcessing(webhookEventId)
markWebhookProcessed(webhookEventId)
markWebhookFailed(webhookEventId, error, nextRetryAt)
```

Important:

- `OutboxEvent` protects outbound domain events.
- `WebhookEvent` is the inbound inbox.

