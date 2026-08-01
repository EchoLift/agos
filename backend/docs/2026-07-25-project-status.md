# Project Status & Implementations
Date: July 25, 2026

This document serves as a checkpoint of everything implemented in the Agency OS backend so far, organized by the Vertical Slice roadmap.

---

## Phase 0: Foundation (✅ COMPLETED)
The foundational infrastructure packages and middleware were established to ensure logging, error handling, and context tracking are robust before adding any business logic.

- **Logger Module**: Implemented using `nestjs-pino`, configured to automatically extract `requestId`, `correlationId`, `userId`, and `agencyId` from the `RequestContext`.
- **Global Exception Filter**: Created to mask unhandled 500 server errors in production, while returning standardized JSON error schemas across all API responses.
- **Request Context**: `AsyncLocalStorage` setup to store and propagate request-specific metadata down to the repository level.

## Phase 1: Auth Module (✅ COMPLETED)
The first domain-specific module, tightly scoped to **Identity only** (no permissions, roles, or agency logic yet).

### Endpoints Implemented
- `POST /api/v1/auth/register`: Hashes email for lookup, encrypts email for storage, hashes password, and creates the `AuthUser`.
- `POST /api/v1/auth/login`: Authenticates the user, returning a short-lived JWT and setting a long-lived 256-bit random opaque string as an `HttpOnly` refresh token.
- `POST /api/v1/auth/refresh`: Consumes the `HttpOnly` refresh token cookie, rotates the token family, and returns a new access token.
- `POST /api/v1/auth/logout`: Revokes the current session and clears cookies.

### Security Enhancements
- **AES-256 Encryption**: Used for encrypting PII like email addresses at rest (`AuthUser.emailEncrypted`).
- **HMAC-SHA256 Blind Indexing**: Used to create searchable, unique hashes of emails (`AuthUser.emailHash`) without exposing the plain text or making it vulnerable to rainbow table attacks.
- **Argon2id**: Configured for secure password hashing.
- **Token Rotation & Reuse Detection**: Refresh tokens are rotated upon every use. If a revoked or already-used token is presented again, the system cascades a revocation across the entire token family to mitigate theft.
- **Strict Password Policy**: Minimum 12 characters, maximum 128 characters, no truncation, Unicode allowed (avoiding arbitrary character composition rules).

### Architecture & Patterns
- **Transactional Outbox**: Implemented in `AuthUserRepository`. Database writes (e.g., creating a user or a session) are wrapped in Prisma `$transaction` blocks alongside the insertion of Domain Events into the `OutboxEvent` table.
- **Repository Encapsulation**: The Service layer is completely decoupled from Prisma logic. Services only communicate with the database via `AuthUserRepository`.
- **Decoupled Audit Logging**: Auth does not write directly to audit logs; instead, it emits explicit events (`UserRegistered`, `UserLoggedIn`, `TokenRotated`, `TokenFamilyRevoked`, `UserLoggedOut`) meant for asynchronous consumption.

### Testing & Documentation
- Unit tests cover boundary logic for `CryptoService`, `PasswordService`, and `TokenService`.
- Integration tests cover `AuthService` behavior, specifically mocking the token reuse detection pathway.
- DTOs and Controllers are decorated with `@nestjs/swagger` annotations to automatically generate the OpenAPI spec.

---

## Phase 2: User Module & Events (✅ COMPLETED)
The event-driven backbone of Agency OS has been implemented to handle provisioning the `User` domain.

### Event Infrastructure Setup (`packages/events`)
- **`RabbitMQService`**: Implemented an asynchronous messaging service using `amqplib` to publish and consume topics via the `agency_os.events` topic exchange.
- **`OutboxRelayService`**: A polling cron job (using `@nestjs/schedule` running every 5 seconds) that pulls `PENDING` events from the Prisma `OutboxEvent` table and pushes them into RabbitMQ, ensuring at-least-once delivery semantics.

### User Domain Implementation (`modules/user`)
- **Repository Pattern**: `UserRepository` abstracts direct Prisma interactions for `User` records.
- **Idempotent Provisioning**: `UserService.provisionUser(authUserId)` gracefully manages `P2002` unique constraint collisions to ensure idempotency.
- **Asynchronous Consumption**: 
  - `UserConsumer` boots alongside the `WorkerModule` and subscribes to the `user_module.user_registered` queue.
  - Upon receiving the `UserRegistered` event published by the Auth module, it extracts the aggregate ID and provisions the application `User` in the background.

### Testing & Verification
- Included `user.consumer.spec.ts` integration tests with mocked `RabbitMQService` subscriptions to guarantee event mapping to `UserService`.
- Overcame `@types/amqplib` ambient typing conflicts to ensure strict compilation across the entire monorepo (`npm run build`).

---

## Phase 3: Organization Module (✅ COMPLETED)
Implemented multi-tenancy foundation with Agency creation, system role deduplication, active session agency context, and a dedicated invitation flow.

### Key Highlights
- **Schema & Multi-Tenancy**: Added `Invitation` model (`PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`), `Session.activeAgencyId`, and optional `Role.agencyId` to share system roles (`OWNER`, `MANAGER`, `MEMBER`) globally without per-agency duplication.
- **Decoupled User Lookups**: Created `UserLookupService` in `UserModule` to handle cross-module profile queries safely without violating repository encapsulation.
- **`@CurrentUser()` Decorator**: Custom parameter decorator for clean, non-intrusive `authUserId` and `sessionId` extraction in controllers.
- **Invitation Flow**: Distinct `Invitation` entity separate from `Membership`. Users receive 7-day single-use secret tokens to accept invitations.
- **Transactional Outbox Events**: Emits `AgencyCreated`, `MemberInvited`, and `MemberJoined` events through `$transaction` blocks.

### Endpoints Implemented
- `POST /api/v1/organizations/agencies`: Create agency tenant, set creator as `OWNER`, update session `activeAgencyId`.
- `GET /api/v1/organizations/me`: Fetch current active agency context and list of all memberships.
- `POST /api/v1/organizations/:agencyId/invitations`: Create pending invitation by email and role.
- `POST /api/v1/organizations/invitations/:token/accept`: Accept pending invitation token and create active membership.

---

## Next Up
- **Phase 4: Gateway Security**: Building JWT Guard, Agency Guard, Permission Guard, and automatic RequestContext population.
