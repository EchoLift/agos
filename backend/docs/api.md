# API Documentation (Living)
Last updated: August 1, 2026

This document serves as the living API documentation, strictly mirroring the endpoints that have been implemented and deployed in code.

## Global Conventions

- **Base Path**: `/api/v1`
- **Request ID**: The server automatically assigns an `X-Request-Id` to all responses for tracing.
- **Access Tokens**: Required for all protected routes, passed as `Authorization: Bearer <token>`.
- **Refresh Tokens**: Handled automatically via HttpOnly cookies (scoped to `/api/v1/auth`).
- **Tenant Context**: Pass `X-Agency-Id: <agency-uuid>` on all workspace-scoped requests. The backend `TenantGuard` resolves the agency in priority order: Path param → Session `activeAgencyId` → `X-Agency-Id` header.
- **Public Routes**: Auth endpoints (`/auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`) are decorated with `@Public()` and do not require a token.

---

## Multi-Tenancy

All data in Agency OS is scoped to an `agencyId`. The `TenantGuard` enforces this automatically on every non-public route.

### Resolving the Agency
The guard resolves the active agency in this priority order:
1. **Path param** — if the route includes `/:agencyId/...`, that wins.
2. **Session** — the server-side session stores `activeAgencyId` from the most recent agency creation or login.
3. **Header** — `X-Agency-Id: <uuid>` sent by the client.

### Frontend Integration Pattern
The frontend resolves `agencySlug` → `agencyId` UUID by calling `GET /organizations/me` once on workspace load, then injects the UUID as `X-Agency-Id` on every subsequent API call via the central `apiClient` wrapper.

### Membership Validation
If an `agencyId` is resolved, the guard verifies that the authenticated `userId` has an `ACTIVE` membership in that agency. Missing or inactive memberships return `403 Forbidden` with code `TENANT_001`.

---

## Auth Module

### Register a User
`POST /auth/register`

Creates a new user identity in the system.

**Request Body** (application/json):
```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

**Responses**:
- `201 Created`: User successfully registered.
  ```json
  {
    "success": true,
    "message": "User registered"
  }
  ```
- `400 Bad Request`: Validation failed or email already in use.

---

### Login
`POST /auth/login`

Authenticates a user, sets a secure refresh token session, and returns an access token.

**Request Body** (application/json):
```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

**Responses**:
- `200 OK`: Login successful.
  ```json
  {
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
  ```
  *(Also sets `refreshToken` HttpOnly cookie)*
- `401 Unauthorized`: Invalid credentials.
- `401 Unauthorized`: `Please sign in with Google` when the account was created through Google and has no password.

---

### Google Login / Registration
`POST /auth/google`

Verifies a Google Identity Services `idToken`, links or creates the auth identity, sets a secure refresh token session, and returns an access token.

This is the recommended registration/login path for the frontend.

**Request Body** (application/json):
```json
{
  "token": "eyJhbGciOiJSUzI1..."
}
```

**Responses**:
- `200 OK`: Google login successful.
  ```json
  {
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
  ```
  *(Also sets `refreshToken` HttpOnly cookie)*
- `401 Unauthorized`: Invalid Google token or unverified Google email.

**Backend behavior**:
- Verifies the Google ID token against `GOOGLE_CLIENT_ID`.
- Requires `email`, `sub`, and `email_verified = true`.
- Looks up existing users by Google provider identity, then by encrypted-email lookup hash.
- Links a Google provider identity to an existing manual account with the same verified email.
- Creates a Google-only account when no matching user exists.

---

### Refresh Token
`POST /auth/refresh`

Rotates the current refresh token and issues a new access token.

**Headers / Cookies**:
- Requires `refreshToken` cookie.

**Responses**:
- `200 OK`: Token refreshed successfully.
  ```json
  {
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
  ```
  *(Also sets a new rotated `refreshToken` HttpOnly cookie)*
- `401 Unauthorized`: Refresh token missing, expired, or compromised.

---

### Logout
`POST /auth/logout`

Revokes the current session and clears the refresh token cookie.

**Headers / Cookies**:
- Requires `refreshToken` cookie.

**Responses**:
- `200 OK`: Session revoked and cookie cleared.
  ```json
  {
    "success": true
  }
  ```

---

## Calendar Module

### Get Role-Aware Calendar Events
`GET /calendar/events`

Returns a calendar read model for workflow tasks and publishing slots in the current agency. This endpoint is permission-filtered by the backend; frontend visibility toggles only hide or show already-authorized event groups.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Query Parameters**:
- `from`: ISO date/time lower bound.
- `to`: ISO date/time upper bound.
- `scope`: `MY_SCHEDULE`, `MY_ROLE`, `MY_TEAM`, `CAMPAIGN`, or `AGENCY`.
- `campaignId`: optional campaign filter.
- `memberId`: optional member filter. Filtering another member requires owner or manager access.
- `eventTypes`: comma-separated event categories such as `WORKFLOW_TASK,PUBLISHING`.
- `statuses`: comma-separated source statuses.
- `platforms`: comma-separated publishing platforms.

**Default Scope**:
- Owner: `AGENCY`
- Manager: `MY_TEAM`
- Other roles: `MY_SCHEDULE`

**Responses**:
- `200 OK`: Calendar events.
  ```json
  {
    "scope": "MY_SCHEDULE",
    "range": {
      "from": "2026-08-01T00:00:00.000Z",
      "to": "2026-08-31T23:59:59.999Z"
    },
    "events": [
      {
        "id": "task:workflow-task-uuid",
        "sourceId": "workflow-task-uuid",
        "eventType": "WORKFLOW_TASK",
        "title": "Write REEL-021",
        "startsAt": "2026-08-04T10:00:00.000Z",
        "endsAt": "2026-08-04T10:00:00.000Z",
        "assignedMembershipIds": ["membership-uuid"],
        "roleKeys": ["WRITER"],
        "campaign": { "id": "campaign-uuid", "name": "August Launch" },
        "client": { "id": "client-uuid", "name": "Nike India" },
        "contentAsset": {
          "id": "asset-uuid",
          "displayCode": "REEL-021",
          "title": "Air Max Launch"
        },
        "visibility": "DIRECT_ASSIGNMENT",
        "status": "IN_PROGRESS",
        "riskStatus": "AT_RISK",
        "owner": { "membershipId": "membership-uuid", "name": "Rahul" },
        "forwardedToMe": true,
        "reason": "Assigned to me"
      }
    ],
    "summary": {
      "total": 1,
      "assignedToMe": 1,
      "publishing": 0,
      "overdue": 0
    }
  }
  ```
- `400 Bad Request`: invalid range, forbidden agency scope, or forbidden member filter.

---

### Generate Production From Publishing Slot
`POST /campaigns/:campaignId/publishing-schedules/:scheduleId/generate-production`

Creates the linked content asset and first workflow task from a publishing slot. This is the bridge between campaign planning and production execution.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Request Body**:
```json
{
  "contentType": "REEL",
  "title": "Reel 1",
  "brief": "Create a conversion-focused launch reel.",
  "scriptDueAt": "2026-08-05T18:00:00.000Z"
}
```

**Backend behavior**:
- Requires owner or manager access.
- Uses the campaign manager assignment, falling back to the actor membership.
- Requires an assigned campaign writer.
- Creates `ContentAsset`, `WorkflowInstance`, and the first `WorkflowTask`.
- Links the publishing slot to the generated content asset.
- Emits `ContentAssetCreated`, `ContentAssigned`, and `PublishingSlotProductionGenerated`.
- Creates an in-app notification for the assigned writer.

---

## Client Module

### Create Client
`POST /clients`

Creates a client under the current agency context.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "name": "Northwind Studios",
  "industry": "E-commerce",
  "brandVoice": "Confident",
  "audience": "Founders",
  "competitors": "Acme, Globex"
}
```

**Responses**:
- `201 Created`: Client created successfully.
- `400 Bad Request`: Validation failed.
- `409 Conflict`: Client tenant context invalid.

---

### List Clients
`GET /clients`

Returns all clients for the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: A list of clients.

---

### Get Client
`GET /clients/:id`

Returns a single client if it belongs to the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Client details.
- `404 Not Found`: Client not found in the current agency.

---

### Update Client
`PATCH /clients/:id`

Updates client profile fields scoped to the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "name": "Northwind Studios",
  "industry": "Retail"
}
```

**Responses**:
- `200 OK`: Client updated.
- `404 Not Found`: Client not found in the current agency.

---

### Archive Client
`POST /clients/:id/archive`

Archives the client.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Client archived.

---

### Restore Client
`POST /clients/:id/restore`

Restores an archived client.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Client restored.

---

### Assign Manager
`POST /clients/:id/assign-manager`

Assigns a membership as the client manager.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "membershipId": "membership-uuid"
}
```

**Responses**:
- `200 OK`: Client manager assigned.

---

## Campaign Module

### Create Campaign
`POST /campaigns`

Creates a campaign under the current agency and client context.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "clientId": "client-uuid",
  "name": "August Growth Campaign",
  "objective": "Grow qualified leads",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31",
  "assignedMembershipIds": ["membership-uuid-1", "membership-uuid-2"]
}
```

**Responses**:
- `201 Created`: Campaign created successfully.
- `400 Bad Request`: Validation failed or invalid date range.
- `409 Conflict`: Client does not belong to the current agency.

---

### List Campaigns
`GET /campaigns`

Returns campaigns for the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: A list of campaigns.

---

### Get Campaign
`GET /campaigns/:id`

Returns a single campaign if it belongs to the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Campaign details.
- `404 Not Found`: Campaign not found in the current agency.

---

### Update Campaign
`PATCH /campaigns/:id`

Updates campaign planning fields scoped to the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "name": "September Growth Campaign",
  "objective": "Increase pipeline",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30"
}
```

**Responses**:
- `200 OK`: Campaign updated.
- `409 Conflict`: Campaign version conflict.

---

### Archive Campaign
`POST /campaigns/:id/archive`

Archives the campaign.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Campaign archived.

---

### Restore Campaign
`POST /campaigns/:id/restore`

Restores an archived campaign.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Campaign restored.

---

### Get Campaign Publishing Agenda
`GET /campaigns/:id/publishing-schedules`

Returns publishing slots for a campaign, grouped as an agenda read model with backend-derived readiness and risk.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Responses**:
- `200 OK`: Publishing agenda.
  ```json
  {
    "summary": {
      "upcoming": 3,
      "ready": 1,
      "atRisk": 1,
      "missed": 0
    },
    "items": [
      {
        "id": "publishing-schedule-uuid",
        "platform": "INSTAGRAM",
        "scheduledAt": "2026-08-04T13:30:00.000Z",
        "timezone": "Asia/Kolkata",
        "status": "PLANNED",
        "riskStatus": "AT_RISK",
        "readiness": "IN_PRODUCTION",
        "readinessReason": "Content is still in EDIT",
        "version": 1
      }
    ]
  }
  ```

---

### Create Publishing Slot
`POST /campaigns/:id/publishing-schedules`

Creates a planned publishing slot. Owners, managers, social media managers, or publishing-permission users can mutate publishing schedules.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Request Body** (application/json):
```json
{
  "platform": "INSTAGRAM",
  "scheduledAt": "2026-08-04T13:30:00.000Z",
  "timezone": "Asia/Kolkata",
  "contentAssetId": "content-asset-uuid",
  "caption": "Launch caption draft",
  "note": "Use festival CTA"
}
```

**Responses**:
- `201 Created`: Publishing slot created.
- `400 Bad Request`: Invalid campaign window, linked content, or permission.

---

### Update Publishing Slot
`PATCH /campaigns/:id/publishing-schedules/:scheduleId`

Updates editable metadata or reschedules the slot. Published and cancelled slots cannot be edited.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Request Body** (application/json):
```json
{
  "scheduledAt": "2026-08-05T13:30:00.000Z",
  "caption": "Updated caption",
  "version": 2
}
```

**Responses**:
- `200 OK`: Publishing slot updated.
- `409 Conflict`: Publishing slot version conflict.

---

### Cancel Publishing Slot
`POST /campaigns/:id/publishing-schedules/:scheduleId/cancel`

Cancels a publishing slot with a reason.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Request Body** (application/json):
```json
{
  "version": 2,
  "cancellationReason": "Client postponed launch"
}
```

**Responses**:
- `200 OK`: Publishing slot cancelled.
- `400 Bad Request`: Slot is already published.
- `409 Conflict`: Publishing slot version conflict.

---

### Mark Publishing Slot Published
`POST /campaigns/:id/publishing-schedules/:scheduleId/mark-published`

Marks a publishing slot as published and stores the live URL.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Request Body** (application/json):
```json
{
  "version": 2,
  "publishedUrl": "https://instagram.com/reel/example",
  "publishedAt": "2026-08-04T13:35:00.000Z"
}
```

**Responses**:
- `200 OK`: Publishing slot marked published.
- `400 Bad Request`: Slot is cancelled.
- `409 Conflict`: Publishing slot version conflict.

---

## Content Asset Module

### Create Content Asset
`POST /content-assets`

Creates a content asset under the current agency context and links it to a client and campaign.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "clientId": "client-uuid",
  "campaignId": "campaign-uuid",
  "displayCode": "REEL-001",
  "type": "REEL",
  "title": "Launch Reel",
  "brief": "Create a launch reel for the new campaign." 
}
```

**Responses**:
- `201 Created`: Content asset created successfully.
- `400 Bad Request`: Validation failed.
- `409 Conflict`: Campaign or client tenant context invalid.

### List Content Assets
`GET /content-assets`

Returns all active content assets for the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: A list of content assets.

### Get Content Asset
`GET /content-assets/:id`

Returns a single content asset if it belongs to the current agency.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Content asset details.
- `404 Not Found`: Content asset not found in the current agency.

### Update Content Asset
`PATCH /content-assets/:id`

Updates planning fields for the content asset.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "title": "Updated Launch Reel",
  "brief": "Refined brief for the launch reel."
}
```

**Responses**:
- `200 OK`: Content asset updated.
- `404 Not Found`: Content asset not found.

### Archive Content Asset
`POST /content-assets/:id/archive`

Archives the content asset.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Content asset archived.

### Restore Content Asset
`POST /content-assets/:id/restore`

Restores an archived content asset.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Content asset restored.

---

## Workflow Module

### Advance Workflow Stage
`POST /content-assets/:id/advance-stage`

Advances a content asset through a valid workflow stage transition using the centralized workflow rules.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "toStage": "WRITING",
  "reason": "Ready to draft"
}
```

**Responses**:
- `200 OK`: Workflow stage transition recorded.
- `400 Bad Request`: The requested transition is invalid.

### Assign Workflow Task
`POST /content-assets/:id/assign`

Assigns the current workflow task to a membership and records assignment history.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "assigneeId": "membership-uuid",
  "workflowStepId": "workflow-step-uuid",
  "stage": "WRITING",
  "reason": "Hand off writing to the producer",
  "deadlineAt": "2026-07-30T12:00:00.000Z"
}
```

**Responses**:
- `200 OK`: Workflow task assigned.
- `400 Bad Request`: Assignment payload invalid.

### Submit Work
`POST /content-assets/:id/submit`

Submits the current workflow task for review.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "workflowTaskId": "workflow-task-uuid",
  "submissionType": "RAW_FOOTAGE",
  "body": "Draft ready for review"
}
```

**Responses**:
- `200 OK`: Submission created.
- `400 Bad Request`: The caller is not the current owner or the payload is invalid.

### Recall Submission
`POST /content-assets/:id/recall-submission`

Recalls an active submission while it is still reviewable.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "submissionId": "submission-uuid"
}
```

**Responses**:
- `200 OK`: Submission recalled.
- `400 Bad Request`: The submission can no longer be recalled.

### Mark Submission as Seen
`POST /content-assets/:id/submissions/:submissionId/seen`

Marks a submitted workflow item as seen by a reviewer.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid"
}
```

**Responses**:
- `200 OK`: Submission marked as seen.
- `404 Not Found`: Submission not found in the current content asset workflow.

### Approve Work
`POST /content-assets/:id/approve`

Approves the current workflow task and can optionally move the content to the next workflow stage.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "workflowTaskId": "workflow-task-uuid",
  "comment": "Looks good",
  "nextOwnerId": "membership-uuid",
  "nextStage": "MANAGER_SCRIPT_REVIEW",
  "nextWorkflowStepId": "workflow-step-uuid",
  "nextDeadlineAt": "2026-07-31T12:00:00.000Z",
  "idempotencyKey": "approval-001"
}
```

**Responses**:
- `200 OK`: Approval recorded.
- `400 Bad Request`: The requested workflow transition is invalid.

### Request Changes
`POST /content-assets/:id/request-changes`

Requests changes on the current workflow task and returns ownership to a specified stage.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "workflowTaskId": "workflow-task-uuid",
  "comment": "Need a tighter draft",
  "returnToOwnerId": "membership-uuid",
  "returnToStage": "WRITING",
  "returnWorkflowStepId": "workflow-step-uuid"
}
```

**Responses**:
- `200 OK`: Changes requested and a new task was created.
- `400 Bad Request`: The requested workflow transition is invalid.

### Block Work
`POST /content-assets/:id/block`

Blocks the current workflow task with a reason and details.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid",
  "workflowTaskId": "workflow-task-uuid",
  "reason": "Waiting on external assets",
  "details": "Need the final brand copy before we can shoot."
}
```

**Responses**:
- `200 OK`: Workflow task blocked.

### Unblock Work
`POST /content-assets/:id/unblock`

Resolves active blockers on the current workflow and returns the task to an active state.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "actorId": "membership-uuid"
}
```

**Responses**:
- `200 OK`: Workflow task unblocked.

---

## Frontend API Integration (July 28, 2026)

The frontend now uses a centralized `apiClient` wrapper (`src/lib/api-client.ts`) that:
- Injects `Authorization: Bearer <token>` from `localStorage` on every call.
- Injects `X-Agency-Id: <uuid>` resolved from the `AgencyProvider` context.
- Automatically calls `POST /auth/refresh` on any `401 Unauthorized` response and retries the original request once (silent token refresh). Only redirects to `/login` if the refresh also fails.
- Standardizes error message extraction from JSON and plain text responses.

All module-specific API calls are thin wrappers in `src/lib/api/*.ts` that call `apiClient` with typed interfaces.

### Post-Login Routing
After a successful Google sign-in (or on page load with an existing valid token), the frontend calls `GET /organizations/me` to check for an existing agency:
- **Has `currentAgency`** → navigate to `/{agency.slug}` (workspace dashboard)
- **No agency** → navigate to `/create-agency`
- **Auth failure / revoked token** → clear `localStorage`, stay on `/login`

---

## Upcoming Product Roadmap

The implemented API is now centered on the platform and the first business modules. The next customer-visible phases are:

- **Founder Dashboard** (`GET /dashboard`): Surface real operational data — active clients, campaigns, content, blocked items, my task queue, pending approvals, and activity feed. Currently returns a placeholder shape; aggregation query to be implemented.
- **Workflow stage advancement UI**: Surface `POST /content-assets/:id/advance-stage` and assignment actions from the frontend workflow page.
- **Notification and audit polish**: Make workflow activity visible to the broader team.

These phases will continue to follow the same conventions already established in this API: tenant-scoped access via `X-Agency-Id`, consistent lifecycle actions, and event-driven behavior via the transactional outbox.

---


## Organization Module

### Create Agency
`POST /organizations/agencies`

Creates a new agency tenant, links the caller as the `OWNER`, sets the session's active agency, and emits an `AgencyCreated` outbox event.

The `slug` is the unique subdomain identifier (used for the workspace URL). The `displayName` is the human-readable label shown across the UI. Slug uniqueness is validated server-side before creation.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "displayName": "Social Expert Media",
  "slug": "social-expert"
}
```

| Field | Type | Rules |
|---|---|---|
| `displayName` | `string` | Required · 2–100 chars · shown in the UI header |
| `slug` | `string` | Required · 3–63 chars · lowercase letters, numbers, hyphens · must be globally unique |

**Responses**:
- `201 Created`: Agency successfully created.
  ```json
  {
    "agency": {
      "id": "c1f7b82e-...",
      "name": "social-expert",
      "displayName": "Social Expert Media",
      "slug": "social-expert"
    },
    "membership": {
      "id": "m9d8e7c6-...",
      "role": "OWNER"
    }
  }
  ```
- `400 Bad Request`: Validation failure (missing fields, slug too short, invalid chars).
- `409 Conflict`: `slug` is already taken by another agency.

---

### Get My Memberships & Active Agency Context
`GET /organizations/me`

Returns the user's currently active agency context along with all agency memberships across the system. Used by the frontend immediately after login to determine whether to route to the workspace dashboard or the create-agency page.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Memberships and active agency retrieved.
  ```json
  {
    "activeAgencyId": "c1f7b82e-...",
    "currentAgency": {
      "id": "c1f7b82e-...",
      "name": "social-expert",
      "displayName": "Social Expert Media",
      "slug": "social-expert",
      "role": "OWNER",
      "membershipId": "m9d8e7c6-..."
    },
    "agencies": [
      {
        "id": "c1f7b82e-...",
        "name": "social-expert",
        "displayName": "Social Expert Media",
        "slug": "social-expert",
        "role": "OWNER",
        "membershipId": "m9d8e7c6-..."
      }
    ]
  }
  ```
- Returns `{ activeAgencyId: null, currentAgency: null, agencies: [] }` when the user has no memberships (new user, should be routed to `/create-agency`).

---

### Get Roles
`GET /organizations/roles`

Returns the available roles for the active agency, including system defaults and agency-specific roles.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Responses**:
- `200 OK`: A list of roles.

---

### Get Members
`GET /organizations/members`

Returns the active team members for the active agency.

**Headers**:
- `Authorization: Bearer <access_token>`
- `X-Agency-Id: <agency-uuid>`

**Responses**:
- `200 OK`: A list of memberships including user details.

---

### Invite Member to Agency
`POST /organizations/:agencyId/invitations`

Creates a pending invitation for a user by email and role ID.

**Headers**:
- `Authorization: Bearer <access_token>`

**Request Body** (application/json):
```json
{
  "email": "editor@example.com",
  "mobileNumber": "+15551234567",
  "roleId": "system-or-custom-role-uuid",
  "roleIds": ["system-or-custom-role-uuid", "custom-role-uuid"]
}
```

**Notes**:
- `mobileNumber` is optional and persisted on the invitation.
- `roleId` is the primary role for the invite.
- `roleIds` is the full role assignment list, including the primary role.

**Responses**:
- `201 Created`: Invitation successfully created.
  ```json
  {
    "invitationId": "i3f2b1a0-...",
    "email": "editor@example.com",
    "mobileNumber": "+15551234567",
    "roleId": "system-or-custom-role-uuid",
    "roleIds": ["system-or-custom-role-uuid", "custom-role-uuid"],
    "status": "PENDING",
    "expiresAt": "2026-08-02T12:00:00.000Z",
    "token": "4f9a3c..."
  }
  ```
- `403 Forbidden`: Caller is not a member of the target agency.
- `400 Bad Request`: Invalid roleId, invalid body, or invalid invitation payload.

---

### Accept Invitation
`POST /organizations/invitations/:token/accept`

Accepts a pending invitation using the secret token and provisions an active membership.

**Headers**:
- `Authorization: Bearer <access_token>`

**Responses**:
- `200 OK`: Invitation accepted.
  ```json
  {
    "membershipId": "m5a4b3c2-...",
    "agencyId": "c1f7b82e-...",
    "status": "ACTIVE"
  }
  ```
- `400 Bad Request`: Invalid or expired invitation token.
- `409 Conflict`: User is already an active member of this agency.

---
*Note: Further endpoints will be appended here as vertical slices are completed.*
