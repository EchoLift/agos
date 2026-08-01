# Project Status & Implementations
Date: July 26, 2026

This document serves as a checkpoint of everything implemented in the Agency OS backend so far, organized by the Vertical Slice roadmap.

## Latest implementation snapshot (July 26, 2026)
The backend is now wired to support the first full local founder journey:

- The API boots locally and serves auth endpoints under `/api/v1/auth` with CORS and cookie parsing configured for the frontend.
- Google sign-in now works end-to-end in local development, including a dev fallback token path when no Google client ID is configured yet.
- The auth flow issues an access token, sets the refresh cookie, and creates a session for the signed-in user.
- The organization and security layers are in place so the app can create agency workspaces and enforce tenant-scoped access once the frontend route is active.
- The backend build passes locally, and the auth endpoint has been verified with live HTTP requests.

## Roadmap v2: capability-first delivery
From this point onward, backend and frontend should evolve together as one vertical slice at a time. The goal is to ship a usable business capability at the end of each milestone rather than completing large isolated backend or frontend phases.

### Backend roadmap
- ✅ Phase 0 Foundation
- ✅ Phase 1 Auth
- ✅ Phase 2 User
- ✅ Phase 3 Organization
- ✅ Phase 4 Security
- ✅ Phase 5 Client
- ✅ Phase 6 Campaign
- ✅ Phase 7 Content Asset
- ✅ Phase 8 Workflow
- ✅ Phase 9 Submission
- ⬜ Phase 10 Founder Command Center: dashboard aggregation endpoint for tasks, approvals, blockers, overdue work, publishing today, activity, and risk summary
- ⬜ Phase 11 Employee Workspace APIs: task list, calendar view, and workflow detail views for role-based work
- ⬜ Phase 12 Agency Setup: agency profile, members, roles, workspace configuration, and later billing controls
- ⬜ Phase 13 Notifications: notification service, WebSocket delivery, and simple UI integration
- ⬜ Phase 14 Calendar: workflow deadlines, campaign dates, and publishing dates in a shared calendar experience
- ⬜ Phase 15 Reports: operational metrics for completion, approval time, late tasks, and blocked time
- ⬜ Phase 16 Team Management: members, roles, permissions, and basic team activity views
- ⬜ Phase 17 Billing: subscription, plan, invoice, and tenant-level billing primitives
- ⬜ Phase 18 AI Layer: AI-assisted writing, captions, campaign summaries, and risk analysis after the workflow is stable

### Delivery rule
Every milestone should end with a capability that a real founder or team member can use. Example milestones:
- Founder can create a client.
- Founder can create a campaign.
- Writer can submit a script.
- Manager can approve it.
- Founder can see it on the dashboard.

---

## Phase 0: Foundation (✅ COMPLETED)
The foundational infrastructure packages and middleware were established to ensure logging, error handling, and context tracking are robust before adding any business logic.

- **Logger Module**: Implemented using `nestjs-pino`, configured to automatically extract `requestId`, `correlationId`, `userId`, and `agencyId` from the `RequestContext`.
- **Global Exception Filter**: Created to mask unhandled 500 server errors in production, while returning standardized JSON error schemas across all API responses.
- **Request Context**: `AsyncLocalStorage` setup to store and propagate request-specific metadata down to the repository level.

---

## Phase 1 & 1.5: Auth Module & OAuth (✅ COMPLETED)
Tightly scoped to **Identity** with support for both password authentication and Google OAuth.

### Endpoints Implemented
- `POST /api/v1/auth/register`: Hashes email for lookup, encrypts email for storage, hashes password, and creates the `AuthUser`.
- `POST /api/v1/auth/login`: Authenticates the user, returning a short-lived JWT and setting a long-lived 256-bit random opaque string as an `HttpOnly` refresh token.
- `POST /api/v1/auth/google`: Verifies Google ID tokens (`google-auth-library`), links or creates accounts via provider identity, and establishes sessions.
- `POST /api/v1/auth/refresh`: Consumes the `HttpOnly` refresh token cookie, rotates the token family, and returns a new access token.
- `POST /api/v1/auth/logout`: Revokes the current session and clears cookies.

### Security Enhancements & Identity Architecture
- **Provider Identities Table (`AuthIdentity`)**: Explicit provider model supporting `GOOGLE`, `GITHUB`, `MICROSOFT`, and `PASSWORD` without adding endless nullable columns.
- **AES-256 Encryption**: Used for encrypting PII like email addresses at rest (`AuthUser.emailEncrypted`).
- **HMAC-SHA256 Blind Indexing**: Used to create searchable, unique hashes of emails (`AuthUser.emailHash` & `AuthIdentity.emailHash`) without exposing plain text.
- **Argon2id**: Configured for secure password hashing (optional for Google-only accounts).
- **Token Rotation & Reuse Detection**: Refresh tokens are rotated upon every use. If a revoked or already-used token is presented again, the system cascades a revocation across the entire token family.

### Architecture & Patterns
- **Transactional Outbox**: Database writes are wrapped in Prisma `$transaction` blocks alongside the insertion of Domain Events into `OutboxEvent`.
- **Decoupled Audit Logging**: Auth emits explicit events (`UserRegistered`, `UserLoggedIn`, `AuthProviderLinked`, `TokenRotated`, `TokenFamilyRevoked`, `UserLoggedOut`).

---

## Phase 2: User Module & Events (✅ COMPLETED)
The event-driven backbone of Agency OS has been implemented to handle provisioning the `User` domain.

### Event Infrastructure Setup (`packages/events`)
- **`RabbitMQService`**: Asynchronous messaging service using `amqplib` to publish and consume topics via `agency_os.events`.
- **`OutboxRelayService`**: A polling cron job (every 5 seconds) pulling `PENDING` events from Prisma `OutboxEvent` and pushing them into RabbitMQ for at-least-once delivery.

### User Domain Implementation (`modules/user`)
- **Repository & Lookup Pattern**: `UserRepository` handles Prisma operations, while `UserLookupService` is exposed for decoupled inter-module profile queries.
- **Idempotent Provisioning**: `UserService.provisionUser(authUserId)` gracefully manages `P2002` unique constraint collisions.
- **Asynchronous Consumption**: `UserConsumer` listens on `user_module.user_registered` to provision application `User` profiles in the background.

---

## Phase 3: Organization Module (✅ COMPLETED)
Multi-tenancy foundation with Agency creation, system role deduplication, active session agency context, and a dedicated invitation flow.

### Key Highlights
- **Schema & Multi-Tenancy**: Added `Invitation` model (`PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`), `Session.activeAgencyId`, and optional `Role.agencyId` to share system roles (`OWNER`, `MANAGER`, `MEMBER`) globally.
- **Decoupled Module Communication**: Uses `UserLookupService` exported from `UserModule` for cross-module queries.
- **`@CurrentUser()` Decorator**: Custom parameter decorator for clean token extraction.
- **Invitation Flow**: Distinct `Invitation` entity separate from `Membership`. Users receive 7-day single-use secret tokens to accept invitations.
- **Transactional Outbox Events**: Emits `AgencyCreated`, `MemberInvited`, and `MemberJoined` events.

### Endpoints Implemented
- `POST /api/v1/organizations/agencies`: Create agency tenant, set creator as `OWNER`, update session `activeAgencyId`.
- `GET /api/v1/organizations/me`: Fetch current active agency context and list of all memberships.
- `POST /api/v1/organizations/:agencyId/invitations`: Create pending invitation by email and role.
- `POST /api/v1/organizations/invitations/:token/accept`: Accept pending invitation token and create active membership.

---

## Phase 4: Gateway Security (✅ COMPLETED)
Cross-cutting NestJS Security Gateway with protected-by-default route enforcement, layered guards, priority tenant resolution, and decoupled security context storage.

### Key Highlights
- **Protected by Default**: Globally registered `JwtAuthGuard`, `TenantGuard`, and `PermissionsGuard` in `ApiModule` (`APP_GUARD`). Routes are protected by default; unauthenticated auth endpoints explicitly use `@Public()`.
- **Tenant Resolution Priority**: Resolves tenant scope in priority order: `Path (/:agencyId/...) -> Session (activeAgencyId) -> Header (X-Agency-Id)`.
- **Security & Request Context Hydration**: `SecurityContextService` stores strongly-typed `IdentityContext` (`authUserId`, `userId`, `sessionId`, `agencyId`, `membershipId`, `role`, `permissions`). `RequestContextService` supports non-destructive `append()` to preserve system tracing (`requestId`, `correlationId`).
- **Standardized Error Codes**: Security exceptions return clean domain error codes (`AUTH_001`, `AUTH_002`, `AUTH_003`, `AUTH_004`, `TENANT_001`, `TENANT_002`, `PERM_001`).
- **Clean `@CurrentUser()` Decorator**: Reusable decorator in `packages/security` providing `IdentityContext` directly to controller handlers without Express dependencies.

---

## Phase 5: Client Module (✅ COMPLETED)
The first true business-domain slice was implemented to move Agency OS from platform plumbing into customer-facing capability.

### Business Actions Implemented
- **Create Client**: Create a client under the current agency context.
- **Update Client**: Update client profile fields while staying scoped to the active tenant.
- **Archive Client**: Soft lifecycle transition from active to archived.
- **Restore Client**: Re-activate an archived client.
- **Assign Manager**: Link a client to a membership within the same agency.

### API Endpoints Implemented
- `POST /api/v1/clients`
- `GET /api/v1/clients`
- `GET /api/v1/clients/:id`
- `PATCH /api/v1/clients/:id`
- `POST /api/v1/clients/:id/archive`
- `POST /api/v1/clients/:id/restore`
- `POST /api/v1/clients/:id/assign-manager`

### Architecture & Platform Fit
- **Tenant-Scoped Access**: All client actions resolve the active agency from the authenticated security context.
- **Domain Events**: Emits `ClientCreated`, `ClientUpdated`, `ClientArchived`, `ClientRestored`, and `ClientManagerAssigned` events through the shared outbox/event bus.
- **Request Context Integration**: Uses the platform’s existing security and request-context infrastructure rather than introducing ad-hoc logic.

### Verification
- Added focused unit tests for client service lifecycle behavior.
- Verified locally with `npx jest --runInBand modules/client/client.service.spec.ts`.
- Verified the monorepo build with `npm run build`.

---

## Phase 6: Campaign Module (✅ IMPLEMENTED)
Keep this intentionally small and container-focused. A campaign is a planning container, not an execution engine.

### Phase 6 Goal
At the end of this phase, a founder should be able to model the relationship between an agency, a client, and a campaign with a simple objective and date range, without any workflow, content, or assignment behavior yet.

### Phase 6 Scope
- **Create Campaign**
- **Update Campaign**
- **Archive Campaign**
- **Restore Campaign**
- **List Campaigns**
- **Get Campaign**

### Campaign Lifecycle
- **DRAFT**
- **ACTIVE**
- **ARCHIVED**

### API Surface
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/:id`
- `PATCH /api/v1/campaigns/:id`
- `POST /api/v1/campaigns/:id/archive`
- `POST /api/v1/campaigns/:id/restore`

### Validation Rules
- **Campaign Name**: required, max 100 characters
- **Date Range**: `startDate` must be less than or equal to `endDate`
- **Client**: must belong to the current agency; never trust cross-tenant IDs

### Business Rules
- **Archive**: archive the campaign as a simple lifecycle action for MVP; workflow enforcement will be added later
- **Restore**: allow only `ARCHIVED -> ACTIVE`
- **Delete**: not implemented; use soft delete semantics instead

### Repository Shape
- `create()`
- `update()`
- `findById()`
- `findMany()`
- `archive()`
- `restore()`

### Domain Events
- `CampaignCreated`
- `CampaignUpdated`
- `CampaignArchived`
- `CampaignRestored`

### Guardrails
- Keep the campaign model focused on identity and planning metadata: name, client, date range, objective, status, strategy, and deliverables.
- Do not introduce workflow tasks, content creation, calendar behavior, or execution logic in this phase.
- Treat Campaign as a container that will later hold content assets and workflow instances.
- Add `displayOrder` for future drag-and-drop ordering, but do not build UI ordering yet.

### Definition of Done
- ✅ Repository
- ✅ Service
- ✅ Controller
- ✅ DTO validation
- ✅ Tenant isolation
- ✅ Optimistic locking
- ✅ Domain events
- ✅ Unit tests
- ✅ Integration tests
- ✅ Swagger
- ✅ No workflow logic
- ✅ No content logic
- ✅ No calendar logic

---

## Phase 7: Content Asset Module (✅ IMPLEMENTED)
This is the first truly unique module in the product. A founder can now create a content asset within a campaign, with a brief and content type, while keeping the scope focused on planning and ownership rather than workflow execution.

### User Story
As a founder, I want to create a content asset for a campaign so that I can organize what needs to be produced.

### Scope
- ✅ Create Content Asset
- ✅ Update Content Asset
- ✅ List Content Assets
- ✅ Get Content Asset
- ✅ Archive Content Asset
- ✅ Restore Content Asset

### Implementation Notes
- Exposed under the content-assets API with tenant-scoped access.
- Uses the same lifecycle conventions as the earlier modules: create, update, archive, restore, and domain events.
- Keeps the module centered on planning and ownership of the deliverable rather than execution flows.

### Guardrails
- Stay focused on the object being produced.
- Do not introduce assignments, submissions, or approvals in this phase.
- Keep the module centered on planning and ownership of the deliverable.

---

## Phase 8: Workflow Engine (✅ IMPLEMENTED)
This is the heart of Agency OS. The platform now has a working workflow engine for content progression, including stage advancement, assignment, submission, approvals, request-changes, and blocking/unblocking.

### User Story
As a founder, I want work to move through a structured production pipeline so that I can track progress without relying on WhatsApp or spreadsheets.

### Scope
- ✅ Create Workflow Instance
- ✅ Advance Stage
- ✅ Assign Work
- ✅ Submit Work
- ✅ Approve / Reject / Request Changes
- ✅ Block / Unblock

### Implementation Notes
- A centralized workflow transition rules layer governs valid progression between stages.
- The API now supports explicit stage advancement and collaboration actions around a content asset workflow.
- The workflow remains intentionally fixed and product-focused rather than introducing a custom workflow builder.

### Guardrails
- Keep the workflow simple at first: idea, writing, manager review, editing, approval, publish.
- Do not build a custom workflow builder yet.
- Let the platform support a fixed, product-grade process before expanding it.

---

## Phase 9: Submission System (✅ IMPLEMENTED)
This phase turns the workflow into a real collaboration experience.

### User Story
As a writer or manager, I want to submit work for review so that the next person can act on it.

### Scope
- ✅ Submit Content
- ✅ Review Submission
- ✅ Approve / Reject / Request Changes
- ✅ Recall Submission

### Implementation Notes
- The workflow now supports submissions, review-state transitions, approvals, and change requests.
- The review path allows a reviewer to mark a submission as seen before acting on it.
- The system remains focused on handoff and review rather than adding email or chat integrations.

### Guardrails
- Keep this focused on handoff and review.
- Do not add email, chat, or external integrations yet.

---

## Phase 10: Founder Dashboard (⏳ NEXT)
This is where the platform begins to feel like a product rather than an internal tool.

### User Story
As a founder, I want to see what is at risk, blocked, waiting for approval, and publishing today so that I can act quickly.

### Scope
- **At Risk Items**
- **Pending Approvals**
- **Blocked Work**
- **Publishing Today**

### Guardrails
- Keep the dashboard focused on operational visibility.
- Do not overbuild analytics or reporting in this phase.

---

## Product Readiness Summary
The platform is now mature enough that the remaining work is directly tied to customer value.

### Completed Platform Layers
- Foundation
- Authentication
- User provisioning
- Organization and tenancy
- Security and authorization
- Client management
- Campaign planning

### Next Customer-Visible Phases
- Content Asset
- Workflow
- Submission
- Founder Dashboard

This is the point where Agency OS transitions from a well-structured backend platform into a product that can actually support agency operations.
