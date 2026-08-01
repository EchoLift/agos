# Backend Foundation Log

Date: July 20, 2026

## Status

The first backend foundation for Agency OS has been created.

The backend currently follows the approved V1 direction:

> Event-driven modular monolith first, microservices later only when real usage proves the need.

This means the codebase is structured with service-ready boundaries, but the first build avoids unnecessary distributed-system complexity.

## What Was Built Today

### Runtime Apps

The backend is split into three runnable apps:

```text
apps/api
apps/worker
apps/websocket
```

Responsibilities:

- `apps/api`: public REST API, gateway-level concerns, module routing.
- `apps/worker`: background workers for queue consumers, notifications, audit, and later scheduled jobs.
- `apps/websocket`: realtime broadcast process.

### Shared Packages

Shared infrastructure lives in:

```text
packages/config
packages/crypto
packages/database
packages/events
```

Responsibilities:

- `config`: required environment variable validation.
- `crypto`: field-level encryption and lookup hashing.
- `database`: Prisma client wrapper.
- `events`: domain event envelope and event bus abstraction.

### Business Modules

The first bounded modules were created:

```text
modules/auth
modules/user
modules/organization
modules/client
modules/campaign
modules/content
modules/workflow
modules/notification
modules/audit
modules/file
```

Each module is intended to own its own business boundary. Future code should avoid reaching into another module's private implementation.

## Architecture Decisions Captured

### 1. Modular Monolith For V1

V1 will not start as many independently deployed microservices.

Reason:

- The product still needs customer validation.
- The founder is solo.
- Microservices would add deployment, debugging, tracing, queue, and data consistency complexity too early.

Decision:

- Keep modules strict.
- Use events.
- Keep extraction possible.
- Do not extract until there is a real operational reason.

### 2. Workflow Owns Content State

Only the Workflow Module should change content asset state.

This prevents duplicated logic like:

```text
/approve-script
/approve-edit
/approve-video
```

Instead, the workflow exposes generic content asset actions.

### 3. Track Work, Not Workers

The backend should support accountability without surveillance.

Allowed:

- Content stage
- Current owner
- Deadlines
- Submissions
- Approvals
- Blockers
- Audit trail

Not allowed:

- Mouse tracking
- Idle tracking
- Screenshots
- Break monitoring
- Fake productivity scoring

## Current Tech Stack

| Layer | Current Choice |
|---|---|
| Backend framework | NestJS |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Queue plan | RabbitMQ |
| Cache / rate limit store | Redis |
| Realtime | Socket.IO |
| Password hashing | Argon2id |
| Field encryption | AES-256-GCM |
| Lookup hashing | HMAC-SHA256 |
| Local infrastructure | Docker Compose |

## Current Commands

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Validate Prisma schema:

```bash
DATABASE_URL=postgresql://agency_os:agency_os@localhost:5432/agency_os npx prisma validate
```

Build all backend apps:

```bash
npm run build
```

Run API app:

```bash
npm run dev:api
```

Run worker app:

```bash
npm run dev:worker
```

Run WebSocket app:

```bash
npm run dev:websocket
```

Start local infrastructure:

```bash
docker compose up -d
```

## Verification Completed

Completed on July 20, 2026:

- Dependencies installed successfully.
- Prisma client generated successfully.
- Prisma schema validated successfully with local database URL.
- TypeScript build passed for:
  - API app
  - Worker app
  - WebSocket app
- Review-driven schema evolution completed:
  - Status strings replaced with enums.
  - Manual `assetCode` replaced with generated `displayCode`.
  - Workflow execution separated into `WorkflowInstance`.
  - Workflow transition history added.
  - Assignment history added.
  - Workflow tasks added for calendar-driven work.
  - Submission versioning added.
  - Approval status and idempotency key added.
  - Notification delivery records separated from notifications.
  - Audit request tracing added.
  - Webhook retry fields added.
  - Soft-delete and optimistic-locking fields added to major mutable records.

Verification commands run:

```bash
npm run prisma:generate
DATABASE_URL=postgresql://agency_os:agency_os@localhost:5432/agency_os npx prisma validate
npm run build
```

## Environment Variables

Defined in `.env.example`:

```text
NODE_ENV
API_PORT
WEBSOCKET_PORT
DATABASE_URL
REDIS_URL
RABBITMQ_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
FIELD_ENCRYPTION_KEY_BASE64
FIELD_LOOKUP_SECRET
CORS_ORIGIN
COOKIE_DOMAIN
```

Important:

- `FIELD_ENCRYPTION_KEY_BASE64` must decode to exactly 32 bytes.
- Production secrets must not use the example values.
- `.env` is ignored by git.

## Privacy And Security Implemented So Far

### Passwords

Passwords are hashed using Argon2id.

### Email Privacy

Auth email is not stored as plain text.

The current auth model stores:

```text
emailEncrypted
emailHash
passwordHash
```

How it works:

- `emailEncrypted`: encrypted using AES-256-GCM.
- `emailHash`: deterministic HMAC hash for login lookup.
- `passwordHash`: Argon2id password hash.

This allows login without exposing readable email addresses in the database.

### Cookies

Refresh token cookie settings:

```text
HttpOnly
SameSite=Lax
Secure in production
```

## Current API Surface

### Auth

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
```

### Organization

```text
POST /api/v1/organizations/agencies
```

### Users

```text
GET /api/v1/users/:id
```

### Clients

```text
POST /api/v1/clients
GET /api/v1/clients/:id
```

### Campaigns

```text
POST /api/v1/campaigns
```

### Content Assets / Workflow

```text
POST /api/v1/content-assets
GET /api/v1/content-assets/:id
PATCH /api/v1/content-assets/:id
POST /api/v1/content-assets/:id/assign
POST /api/v1/content-assets/:id/submit
POST /api/v1/content-assets/:id/recall-submission
POST /api/v1/content-assets/:id/approve
POST /api/v1/content-assets/:id/request-changes
POST /api/v1/content-assets/:id/block
POST /api/v1/content-assets/:id/unblock
```

### Files

```text
POST /api/v1/files/external-links
```

## Current Database Models

Created in `prisma/schema.prisma`:

```text
AuthUser
Agency
User
Membership
Role
Permission
RolePermission
Client
Campaign
ContentAsset
ContentAssetSequence
WorkflowTemplate
WorkflowStep
WorkflowInstance
WorkflowTask
WorkflowTransition
AssignmentHistory
Submission
Approval
Blocker
FileAsset
Notification
NotificationDelivery
AuditEvent
WebhookEvent
```

## Design Documents Added

Added on July 20, 2026:

- `docs/2026-07-20-event-catalog.md`
- `docs/2026-07-20-state-machine.md`
- `docs/2026-07-20-api-contract.md`

## Workflow Rules Implemented So Far

### Create Content Asset

Creates a content asset with:

- Agency
- Client
- Campaign
- Generated display code
- Type
- Title
- Brief
- Current stage
- Current owner
- Manager
- Deadline
- Risk status
- Workflow instance
- First workflow transition

Initial stage:

```text
IDEA
```

### Assign Content

Updates:

- Current owner
- Current stage
- Deadline

Publishes:

```text
ContentAssigned
```

### Submit Work

Only the current owner can submit work.

Creates a submission with:

- Submission type
- Body
- Optional external link
- Status `SUBMITTED`

Publishes:

```text
SubmissionCreated
```

### Recall Submission

A submission can be recalled only if:

- The actor created it.
- The status is `SUBMITTED`.
- The submission has not been seen.

Once `seenAt` exists, recall is blocked.

Publishes:

```text
SubmissionRecalled
```

### Approve

Creates an approval record.

Optionally moves the content asset to:

- Next owner
- Next stage
- Next deadline

Publishes:

```text
ApprovalGranted
```

### Request Changes

Creates an approval record with status:

```text
CHANGES_REQUESTED
```

Moves the asset back to:

- Return owner
- Return stage

Publishes:

```text
ChangesRequested
```

### Block Work

Creates an active blocker.

Updates content risk status:

```text
BLOCKED
```

Publishes:

```text
BlockerRaised
```

### Unblock Work

Resolves active blockers for the content asset.

Updates content risk status:

```text
ON_TRACK
```

Publishes:

```text
BlockerResolved
```

## Current Domain Events

Defined in `packages/events/domain-event.ts`:

```text
AgencyCreated
UserRegistered
MemberInvited
UserJoinedAgency
RoleChanged
ManagerAssigned
ClientCreated
ClientUpdated
CampaignCreated
CampaignArchived
ContentAssetCreated
ContentAssigned
WorkflowStageChanged
SubmissionCreated
SubmissionViewed
SubmissionRecalled
SubmissionAccepted
SubmissionRejected
ApprovalGranted
ApprovalRejected
ChangesRequested
BlockerRaised
BlockerResolved
DeadlineMissed
NotificationQueued
NotificationSent
NotificationFailed
WebhookReceived
AuditRecorded
```

## Known Gaps

These are intentionally not complete yet:

- Real JWT auth guard on protected endpoints.
- Permission guard.
- Agency isolation guard.
- Persisted outbox table for reliable event publishing.
- RabbitMQ producer/consumer implementation.
- User profile creation from `UserRegistered` event.
- Refresh token rotation persistence.
- Idempotency key table.
- Rate limiting implementation.
- CSRF enforcement.
- Full audit recording for every workflow action.
- Notification consumers.
- WebSocket event consumers.
- Tests.

## Next Recommended Backend Step

Next build step:

> Add auth guard, agency isolation, permissions, and a persisted outbox.

Reason:

The current APIs compile and model the domain, but they should not be treated as secure until every request is authenticated, scoped to an agency, and permission checked.
