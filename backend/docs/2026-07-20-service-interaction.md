# Service Interaction Diagram

Date: July 20, 2026

## Purpose

This document defines who can call whom and what must happen through events.

## Rule

Only the application layer changes the database through repositories.

Consumers react to outbox events. They should not reach back into unrelated modules unless a repository contract explicitly allows it.

## Approved Runtime Flow

```text
Internet
  |
API Gateway
  |
Authentication Middleware
  |
Request Context
  |
REST Controllers / Socket Gateway
  |
Application Services
  |
Repositories
  |
PostgreSQL Transaction
  |
Domain Events + Outbox
  |
Outbox Publisher
  |
RabbitMQ
  |
Notification / WebSocket / Audit Consumers
```

## Synchronous Calls Allowed

```text
Controller -> Application Service
Application Service -> Own Repository
Application Service -> RequestContext
Application Service -> EventBus/Outbox
Application Service -> Permission Guard
```

## Synchronous Calls To Avoid

```text
Workflow Service -> Notification Service
Workflow Service -> WebSocket Service
Notification Service -> Workflow Repository
WebSocket Service -> Workflow Repository
Audit Service -> Workflow Repository
```

Reason:

Those should be event reactions, not direct dependencies.

## Event Reactions

| Event | Consumer | Action |
|---|---|---|
| `ContentAssigned` | Notification | Notify assignee |
| `ContentAssigned` | WebSocket | Broadcast updated task queue |
| `ContentAssigned` | Audit | Record assignment |
| `SubmissionCreated` | Notification | Notify manager/approver |
| `SubmissionCreated` | WebSocket | Broadcast submission update |
| `ApprovalGranted` | Notification | Notify previous and next owner |
| `ChangesRequested` | Notification | Notify returned owner |
| `BlockerRaised` | Notification | Notify manager |
| `DeadlineMissed` | Notification | Notify owner and manager |
| `WebhookReceived` | Worker | Process inbound webhook |

## Database Ownership

| Module | Owns |
|---|---|
| Auth | `AuthUser`, `Session` |
| Organization | `Agency`, `Membership`, `Role`, `Permission` |
| Client | `Client` |
| Campaign | `Campaign` |
| Content | `ContentAsset`, `ContentAssetSequence`, `FileAsset` |
| Workflow | `WorkflowInstance`, `WorkflowTask`, `WorkflowTransition`, `AssignmentHistory`, `Submission`, `Approval`, `Blocker` |
| Notification | `Notification`, `NotificationDelivery` |
| Audit | `AuditEvent` |
| Events | `OutboxEvent`, `WebhookEvent` |

