# Agency OS Low-Level Design

Last updated: July 20, 2026

## Product Principle

Agency OS is a workflow operating system for creative agencies.

The platform tracks work, not workers. It should give founders and managers accountability without bringing surveillance culture into creative work.

Core promise:

> The founder briefs once, and the platform coordinates the production pipeline.

## Core Business Object

The central object is the `Content Asset`.

A content asset can be a reel, carousel, static post, story pack, ad creative, or any client deliverable.

Everything in the system exists to move a content asset from idea to published.

```text
Client
  -> Campaign
    -> Content Asset
      -> Workflow Stage
      -> Owner
      -> Submission
      -> Approval
      -> Audit Trail
```

## Architecture Style

V1 architecture: event-driven modular monolith.

Long-term architecture: extract high-pressure modules into microservices only after real usage proves the need.

This follows LEAN:

> Remove complexity until complexity becomes necessary.

The system should be designed with strict boundaries from day one, but it should not start as ten separately deployed services. As a solo founder, the first goal is to validate whether agencies will pay for the workflow, not to spend months wiring service discovery, tracing, distributed retries, and cross-service debugging.

Recommended V1 deploy:

- API Gateway
- Backend application with bounded modules
- Worker process for queue consumers
- WebSocket process
- PostgreSQL
- Redis
- RabbitMQ

Recommended V1 code shape:

```text
Agency OS
├── apps
│   ├── web
│   ├── api
│   ├── worker
│   └── websocket
├── modules
│   ├── auth
│   ├── user
│   ├── organization
│   ├── client
│   ├── campaign
│   ├── content
│   ├── workflow
│   ├── notification
│   ├── audit
│   └── file
└── packages
    ├── database
    ├── events
    ├── crypto
    ├── config
    └── logger
```

Each module should contain:

```text
controller
service
repository
events
dto
entity
permissions
```

Modules should not freely import each other's internals. They communicate through exported interfaces and domain events. When a module becomes too large or operationally independent, it can be extracted into its own service without rewriting the business model.

## High-Level System

### V1 Runtime

```text
Browser / Mobile Web
        |
        v
API Gateway / API App
        |
        +---------------- REST ----------------+
        |                                      |
        v                                      v
Bounded Modules                         PostgreSQL
        |
        +---------------- RabbitMQ -----------+
                                               |
        +----------------+---------------------+
        |                |
        v                v
Worker Process          WebSocket Process
```

### Long-Term Extraction Path

```text
Browser / Mobile Web
        |
        v
API Gateway
        |
        +---------------- REST ----------------+
        |                                      |
        v                                      v
Auth Service                         Core Workflow Service
        |                                      |
        +---------------- RabbitMQ -----------+
                                               |
        +----------------+---------------------+----------------+
        |                |                                      |
        v                v                                      v
Notification Service    WebSocket Service                      Audit Service
```

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Backend | NestJS |
| API Gateway | NestJS/Fastify middleware layer inside API app first |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue | RabbitMQ |
| Cache / Rate Limits | Redis |
| WebSocket | Socket.IO |
| Auth | JWT access token + HttpOnly refresh cookie |
| Password Hashing | Argon2id |
| Field Encryption | AES-256-GCM |
| Secrets | Cloud KMS later, environment secrets initially |
| Logs | Pino structured logs |
| Observability | OpenTelemetry later |
| Deployment | Docker Compose first, managed containers later |

## Module Boundaries

The names below are written as services because each boundary may become a service later. In V1, treat them as strict modules inside the same backend repository.

### 1. API Gateway Module

The gateway is the only public entry point.

Responsibilities:

- Cookie handling
- CORS
- CSRF protection
- Rate limiting
- Request ID creation
- JWT verification
- Request logging
- Idempotency key validation
- Route forwarding
- Webhook intake

The gateway must not contain business logic.

### 2. Auth Module

Owns identity only.

Responsibilities:

- Register
- Login
- Refresh token rotation
- Logout
- Password reset
- Email verification
- Session revocation

Auth Module stores:

- Email
- Password hash
- Auth status
- Refresh token family
- Login history

It does not store user profile, agency role, or employee details.

### 3. User Module

Owns user profile and agency membership.

Responsibilities:

- User profile
- Agency membership
- Role assignment
- Role promotion
- User preferences

Auth and User stay in sync through events.

```text
UserRegistered
  -> Auth Module publishes event
  -> User Module creates profile
  -> Audit Module records registration
```

In V1 this can happen inside the same application through the event bus. The design should still use the event contract so it can move to RabbitMQ consumers later without changing the domain flow.

### 4. Organization Module

Owns agency structure.

Responsibilities:

- Agency
- Branches or departments
- Teams
- Roles
- Permissions
- Reporting hierarchy

Important rule:

Do not hardcode role checks like `role == writer`.

Use permissions.

Example:

```text
role: Writer
permissions:
  - content.view_assigned
  - script.submit
  - submission.recall_own
```

### 5. Client Module

Owns client information.

Responsibilities:

- Client profile
- Brand details
- Audience
- Competitors
- Brand voice
- Client contacts
- Assigned manager

Sensitive client fields should be encrypted.

### 6. Campaign Module

Owns campaigns and content plans.

Responsibilities:

- Strategy notes
- Monthly content calendar
- Campaign goals
- Content pillars
- Planned content assets

Campaigns create content assets but do not control workflow transitions.

### 7. Workflow Module

This is the heart of the product.

Responsibilities:

- Content asset lifecycle
- Stage transitions
- Ownership transfer
- Deadlines
- Submissions
- Recalls
- Approvals
- Rejections
- Blocked states
- Handoffs

Only Workflow Module can change the state of a content asset.

Example lifecycle:

```text
Idea
  -> Writing
  -> Manager Script Review
  -> Shoot
  -> Editor Intake
  -> Editing
  -> Manager Edit Review
  -> Client Approval
  -> Scheduled
  -> Published
```

### 8. Notification Module / Worker

Notifications are event-driven.

Responsibilities:

- Email notifications
- In-app notifications
- Future WhatsApp/SMS/push notifications
- Notification templates
- Delivery retry
- Dead letter handling

No module sends notifications directly.

```text
ContentAssigned
  -> RabbitMQ
  -> Notification Worker
  -> Notify assignee
```

### 9. WebSocket Module / Process

WebSocket process only broadcasts realtime updates.

Responsibilities:

- Socket authentication
- Agency rooms
- User rooms
- Client workspace rooms
- Live workflow updates
- Online presence, if needed later

It must not own workflow business logic.

```text
WorkflowChanged
  -> RabbitMQ
  -> WebSocket Process
  -> Broadcast to allowed rooms
```

### 10. Audit Module

Audit trail is immutable.

Responsibilities:

- Record important events
- Store actor, target, action, timestamp, metadata
- Support dispute resolution
- Support founder/manager visibility

Audit events:

- User invited
- Role changed
- Manager assigned
- Content asset created
- Owner changed
- Submission created
- Submission recalled
- Approval granted
- Revision requested
- Client rejected
- Deadline missed
- Work blocked

### 11. File Module

V1 should avoid storing heavy media.

Responsibilities:

- Store file metadata
- Store Google Drive links
- Store reference links
- Associate links with content assets
- Later migrate to S3-compatible object storage

V1 rule:

Final cuts and raw footage can live in Drive links until the product has enough revenue to justify managed media storage.

## Data Privacy And Encryption

Security goal:

Even if the database is exposed, sensitive business and personal data should not be readable directly.

### Transport Security

- Use HTTPS everywhere.
- Use TLS for database, Redis, and RabbitMQ connections where supported.
- No plaintext credentials in logs.

### Passwords

- Use Argon2id.
- Never store plain passwords.
- Never log password fields.

### Token Strategy

- Access token: short-lived JWT, around 10 to 15 minutes.
- Refresh token: HttpOnly, Secure, SameSite=Lax cookie.
- Rotate refresh tokens.
- Reuse detection should revoke the token family.

### Field-Level Encryption

Use AES-256-GCM for sensitive fields.

Encrypt:

- Email
- Phone
- UPI ID
- Bank details
- GST details
- Address
- Client contact details
- Private client notes

Keep searchable fields carefully designed. For encrypted email/phone lookup, store a separate keyed hash.

Example:

```text
email_encrypted = AES_GCM(email)
email_hash = HMAC_SHA256(email_normalized, lookup_secret)
```

### Multi-Tenancy

Every record must belong to an agency.

Required column:

```text
agency_id
```

No query should return cross-agency data unless the caller has platform admin permission.

## Core Entities

### Agency

```text
id
name
slug
status
created_at
updated_at
```

### User

```text
id
auth_user_id
name
avatar_url
timezone
language
created_at
updated_at
```

### Membership

```text
id
agency_id
user_id
role_id
manager_user_id
status
joined_at
```

### Role

```text
id
agency_id
name
description
```

### Permission

```text
id
key
description
```

### RolePermission

```text
role_id
permission_id
```

### Client

```text
id
agency_id
assigned_manager_id
name
industry
brand_voice
audience
competitors
status
created_at
updated_at
```

### Campaign

```text
id
agency_id
client_id
name
objective
start_date
end_date
status
created_by
created_at
updated_at
```

### ContentAsset

```text
id
agency_id
client_id
campaign_id
display_code
type
title
brief
status
created_at
updated_at
```

### WorkflowTemplate

```text
id
agency_id
name
description
content_type
is_active
```

### WorkflowStep

```text
id
agency_id
template_id
stage
sort_order
role_id
requires_acceptance
requires_approval
expected_duration_minutes
```

### WorkflowInstance

```text
id
agency_id
content_asset_id
template_id
current_step_id
current_task_id
manager_membership_id
risk_status
deadline_at
status
started_at
completed_at
```

### WorkflowTask

```text
id
agency_id
workflow_instance_id
workflow_step_id
display_name
owner_membership_id
status
deadline_at
accepted_at
completed_at
```



### Submission

```text
id
agency_id
workflow_task_id
submitted_by
submission_type
version
body
external_link
status
seen_at
recalled_at
created_at
```

Submission statuses:

```text
submitted
seen
accepted
rejected
recalled
```

### Approval

```text
id
agency_id
workflow_task_id
approver_id
status
comment
idempotency_key
request_id
created_at
```

### Blocker

```text
id
agency_id
workflow_task_id
blocked_by
reason
details
status
created_at
resolved_at
```

### AuditEvent

```text
id
agency_id
actor_id
request_id
correlation_id
event_type
entity_type
entity_id
metadata_json
created_at
```

## Workflow Rules

### Ownership

Every active content asset must have:

- Current stage
- Current owner
- Deadline
- Next legal actions

If ownership is unclear, the workflow is broken.

### Submission Recall

User can recall a submission only if:

- They created the submission.
- Submission status is `submitted`.
- Approver has not opened it.

Once `seen_at` is set, recall is disabled.

### DOP To Editor Handoff

DOP submission does not automatically complete DOP work.

```text
DOP submits raw footage link
  -> status: waiting_editor_acceptance
  -> Editor gets incoming item
  -> Editor accepts
  -> DOP ownership closes
  -> Editor ownership starts
```

This avoids blame when footage was uploaded but not actually received or accepted.

### Blocked Work

A user can mark work as blocked.

Required blocker reason:

- Waiting for client
- Waiting for assets
- Need clarification
- Waiting for approval
- Technical issue
- Other

Blocked state is about the work, not the worker.

### Escalation

Escalation should be gentle and work-focused.

Example:

```text
Deadline missed
  -> Notify current owner
  -> Notify manager
  -> If still unresolved after configured time, notify founder
```

Do not track mouse activity, idle time, screenshots, or break time.

## Role Dashboards

### Writer

Question answered:

> What do I need to write today?

Shows:

- Assigned reels sorted by deadline
- Brief
- Client profile link
- Co-workers
- Deadline
- Submit script form
- Submitted queue
- Recall button when allowed

### DOP

Question answered:

> What do I need to shoot, and what is waiting for editor acceptance?

Shows:

- Upcoming shoots
- Approved scripts
- Client context
- Editor assigned
- Submit raw footage link
- Waiting for editor acceptance

### Editor

Question answered:

> What footage has arrived, and what do I need to edit?

Shows:

- Incoming DOP submissions
- Accept / reject intake
- Editing queue
- Submit final cut link
- Returned edits

### Manager

Question answered:

> Which client needs my attention?

Shows:

- Assigned clients
- Pending approvals
- Blocked content
- Delayed content
- Client feedback needing explanation
- Team handoff issues

### Founder

Question answered:

> What is preventing the agency from running smoothly?

Shows:

- Agency health
- Manager health
- Delayed work
- At-risk clients
- Pending high-level approvals
- Escalations

Founder should not see every content item by default.

### Client

Question answered:

> What do I need to approve?

Shows:

- Read-only strategy
- Read-only calendar
- Pending approvals
- Comment / approve / request changes
- Approved history

## API Design

Avoid duplicate APIs.

Do not create separate endpoints like:

```text
/approve-script
/approve-edit
/approve-video
```

Use generic workflow actions.

Examples:

```text
POST /v1/content-assets
GET /v1/content-assets/:id
PATCH /v1/content-assets/:id
POST /v1/content-assets/:id/submit
POST /v1/content-assets/:id/recall-submission
POST /v1/content-assets/:id/approve
POST /v1/content-assets/:id/request-changes
POST /v1/content-assets/:id/block
POST /v1/content-assets/:id/unblock
POST /v1/content-assets/:id/assign
```

Workflow Module decides whether the action is legal.

## Event Catalog

### Auth Events

```text
UserRegistered
UserLoginSucceeded
UserLoginFailed
UserLoggedOut
RefreshTokenRotated
PasswordResetRequested
PasswordChanged
```

### Organization Events

```text
AgencyCreated
UserInvited
UserJoinedAgency
RoleCreated
RoleChanged
PermissionChanged
ManagerAssigned
```

### Client Events

```text
ClientCreated
ClientUpdated
ClientManagerChanged
ClientArchived
```

### Campaign Events

```text
CampaignCreated
CampaignStrategyUpdated
ContentCalendarCreated
ContentAssetPlanned
```

### Workflow Events

```text
ContentAssetCreated
ContentAssigned
WorkflowStageChanged
SubmissionCreated
SubmissionViewed
SubmissionRecalled
SubmissionAccepted
SubmissionRejected
ApprovalGranted
ChangesRequested
BlockerRaised
BlockerResolved
DeadlineMissed
ContentPublished
```

### Notification Events

```text
NotificationQueued
NotificationSent
NotificationFailed
NotificationRetryScheduled
```

## Queue Design

Use RabbitMQ exchanges by domain.

```text
auth.events
organization.events
client.events
campaign.events
workflow.events
notification.events
audit.events
```

Every consumer must support:

- Idempotency
- Retry
- Dead letter queue
- Event versioning

Event envelope:

```json
{
  "event_id": "uuid",
  "event_type": "ContentAssigned",
  "event_version": 1,
  "agency_id": "uuid",
  "actor_id": "uuid",
  "occurred_at": "2026-07-20T10:00:00Z",
  "correlation_id": "uuid",
  "payload": {}
}
```

## Webhook Rules

No webhook should directly run business logic.

Flow:

```text
Webhook received
  -> Gateway persists raw webhook
  -> Verify signature
  -> Publish event
  -> Worker processes event
  -> Retry on failure
  -> Dead letter after max retries
```

Required webhook table:

```text
id
provider
event_type
signature_valid
raw_payload
processing_status
received_at
processed_at
```

## WebSocket Rules

Sockets should be predictable and closed-ended.

Rules:

- Authenticate socket connection.
- Join user room.
- Join agency room only if allowed.
- Join client/content rooms only when user has access.
- Broadcast from events, not direct service calls.
- Never trust socket messages for critical state changes.

Critical changes must go through REST APIs and Workflow Module.

Socket event examples:

```text
content.updated
submission.created
approval.requested
deadline.missed
notification.created
```

## LEAN Build Plan

## Microservice Extraction Criteria

Do not extract a module because it feels architecturally clean. Extract only when one of these becomes true:

- The module needs to scale independently.
- The module has different reliability requirements.
- The module needs independent deployment without risking the core workflow.
- The module has a different data storage pattern.
- The module has enough code ownership or operational complexity to justify the split.

Likely extraction order:

1. WebSocket process, because realtime connections have different scaling behavior.
2. Notification worker, because retries and delivery providers can fail independently.
3. File service, once the platform starts storing actual media.
4. Workflow service, only after the state machine becomes stable and business-critical.

### Phase 1: Validation MVP

Deploy shape:

- One Next.js web app.
- One NestJS API app with strict modules.
- One worker process for event consumers.
- One WebSocket process for realtime broadcasts.
- One PostgreSQL database with schema boundaries.
- RabbitMQ for domain events that must survive process restarts.

Build only:

- Auth
- Agency setup
- Roles and employees
- Client profiles
- Campaign and content assets
- Writer dashboard
- DOP dashboard
- Editor dashboard
- Manager dashboard
- Basic founder health view
- Workflow transitions
- Email/in-app notifications
- Audit trail
- Drive link metadata

Do not build yet:

- Payroll
- Full invoicing
- In-app chat
- Media hosting
- Advanced analytics
- Workflow designer
- Mobile native app
- AI generation suite

### Phase 2: Workflow Strength

Add:

- Custom workflow templates
- More content types
- Client approval portal improvements
- Escalation rules
- Manager delegation reports
- Better notification preferences

### Phase 3: Monetization Expansion

Add:

- Billing
- Invoicing
- Team workload reports
- AI strategy assistant
- AI script assistant
- Media storage
- WhatsApp integration

## Engineering Rules

1. Every user action must have one source of truth.
2. Every important state change must publish an event.
3. Every event must be idempotent.
4. Every record must include `agency_id`.
5. Every sensitive field must be encrypted or intentionally marked public.
6. No module should directly read another module's private tables.
7. Gateway handles edge concerns, not business logic.
8. WebSocket process broadcasts; it does not decide.
9. Notification worker sends; it does not decide.
10. Workflow Module owns content asset state.
11. Do not extract a module into a microservice until there is a clear operational reason.

## Open Decisions Before Code

- Which module should be extracted first if usage grows: notification, websocket, or workflow?
- Will the first version support only fixed workflows or agency-level workflow templates?
- Which fields must be searchable despite encryption?
- Will clients need login in V1, or should approval links be tokenized?
- What is the minimum useful founder dashboard?
- Should deadlines be strict timestamps or date-level commitments?
- How many roles are predefined during agency onboarding?
- What is the first paid plan limit: users, clients, or active content assets?
