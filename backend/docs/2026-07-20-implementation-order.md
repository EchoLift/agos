# Implementation Order & Vertical Slices

Date: July 20, 2026

## Goal
Shift from designing to building one complete vertical slice at a time.

## Phase 0: Foundation (Week 1)

packages/
    config
    database
    crypto
    events
middleware/
    RequestContext
    Logger
    ExceptionFilter

Nothing business-related yet.
Just make the infrastructure rock solid.

---

## Phase 1: Auth Module ⭐⭐⭐⭐⭐ (✅ COMPLETED)

This is the first real module because every other module depends on it.

Implement:
AuthModule
├── register
├── login
├── refresh
├── logout
├── sessions
└── password hashing

Features:
* Argon2id
* AES-256 email encryption
* Email lookup hash
* JWT
* Refresh cookies
* Session persistence
* Refresh token rotation

Do not implement permissions yet.
Only identity.

---

## Phase 2: User Module

Consumes
`UserRegistered`

Creates
`User`

Simple. This is your first event-driven flow.

Register
↓
Auth
↓
Outbox
↓
RabbitMQ
↓
User Consumer
↓
Create User

If this works… Your event architecture is proven.

---

## Phase 3: Organization Module

Implement:
* Agency
* Membership
* Role
* Permission

Then:
`POST /organizations/agencies`

Now users belong to agencies. Everything after this becomes tenant-aware.

---

## Phase 4: Gateway Security ⭐⭐⭐⭐⭐

Before touching Clients.

Implement:
JWT Guard
↓
Agency Guard
↓
Permission Guard
↓
Request Context

Every request should automatically know:
* userId
* membershipId
* agencyId
* requestId
* correlationId

No controller should parse JWT manually. Ever.

---

## Phase 5: Client Module

Simple CRUD. Nothing fancy.
* Create
* Update
* Archive
* Assign Manager

This validates:
* repositories
* optimistic locking
* agency isolation

---

## Phase 6: Campaign Module

Again. Simple.
No workflow yet.

---

## Phase 7: Content Module

Only:
Create Content Asset

No approvals. No submissions. No notifications.

Just:
Generate Display Code
↓
Create Content
↓
Create Workflow Instance
↓
Create First Task
↓
Publish Event

Exactly as your API contract specifies.

---

## Phase 8: Workflow Module ⭐⭐⭐⭐⭐

This is your core.

Implement:
Assign
↓
Submit
↓
Approve
↓
Request Changes
↓
Block
↓
Unblock

Don’t build every transition.
Implement only:
IDEA
↓
WRITING
↓
MANAGER REVIEW

Once those three work… The remaining stages are repetitive.

---

## Phase 9: Outbox Worker

Now:
DB Commit
↓
Outbox
↓
RabbitMQ

Actually works. This proves your event system.

---

## Phase 10: Notification Consumer

Consumes:
`SubmissionCreated`
↓
Notification

Only: In-App Initially.
No email. No SMS. No WhatsApp.
Remember LEAN.

---

## Phase 11: WebSocket

Consumes:
`ContentAssigned`
↓
Broadcast

Nothing more.
Sockets should never contain business logic.

---

## Phase 12: Audit

Consumes every event.
Stores immutable history.
Done.

---

## Vertical Slice Principle

Don’t build modules completely. Build one feature completely.

Example:
Register User
↓
Login
↓
Create Agency
↓
Create Client
↓
Create Campaign
↓
Create Content
↓
Assign Writer
↓
Submit Script
↓
Approve
↓
Notification
↓
WebSocket
↓
Audit

That single path exercises almost every architectural decision you’ve made.

---

## Definition of Done for every module

Before moving to the next module, ask:
* [ ] Repository implemented
* [ ] Service implemented
* [ ] Controller implemented
* [ ] DTO validation complete
* [ ] Unit tests pass
* [ ] Emits domain events
* [ ] Writes audit
* [ ] Uses optimistic locking
* [ ] Uses request context
* [ ] Honors agency isolation
* [ ] No direct cross-module repository access
* [ ] OpenAPI updated

If any box is unchecked… The module isn’t finished.

---

## What I would not build until a paying customer asks

* Analytics
* Dashboard metrics
* Custom workflow builder (keep using your predefined templates first)
* AI assistant
* Advanced search
* Time tracking
* Multi-region deployment
* Kubernetes
* Complex reporting

Those are all attractive distractions. Startups are graveyards full of beautifully engineered features that nobody needed.

---

## The milestone I’d aim for first

Your first milestone shouldn’t be “Auth Module complete.”
It should be:
**A writer logs in, sees one assigned task, submits a script, the manager approves it, the next task is automatically created, the assignee gets an in-app notification, the WebSocket updates the UI instantly, and an audit record exists for every step.**

If that flow works end-to-end, you’ve validated almost every major architectural decision you’ve made:
* modular boundaries
* event-driven communication
* workflow state machine
* repository contracts
* outbox pattern
* notifications
* realtime updates
* and audit logging.

After that, expanding from scripts to shooting, editing, and client approval becomes adding workflow steps rather than inventing new architecture. That’s exactly where you want to be.
