# API Documentation (Living)

Last updated: August 8, 2026

This document mirrors the REST endpoints currently implemented in the AGOS NestJS API. Base path is `/api/v1`.

## Global Conventions

- Protected routes require `Authorization: Bearer <access_token>`.
- Public auth routes are `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, and `POST /auth/refresh`.
- Workspace routes use tenant context from path params, active session agency, or `X-Agency-Id`.
- The API issues `X-Request-Id` for tracing.
- Refresh tokens are opaque, rotated, and stored in HttpOnly cookies scoped to `/api/v1/auth`.
- Business writes should emit domain events through the transactional outbox.

## Tenant Resolution

The backend resolves agency context in this order:

1. Route parameter such as `:agencyId`.
2. Active agency stored on the session.
3. `X-Agency-Id` header.

When an agency is resolved, the authenticated user must have an active membership in that agency.

## Route Ownership Note

The codebase currently has overlapping `content-assets` routes in both the Content module and the legacy Workflow controller:

- `POST /content-assets`
- `GET /content-assets/:id`
- `PATCH /content-assets/:id`

This should be resolved during the security/API cleanup slice. Until then, the documented contract below marks legacy workflow routes explicitly.

---

## Auth

### Register

`POST /auth/register`

Creates an email/password auth identity.

Request:

```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

Response:

```json
{
  "success": true,
  "message": "User registered"
}
```

### Login

`POST /auth/login`

Authenticates an email/password account and sets the refresh cookie.

Request:

```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "expiresIn": 900
}
```

Google-only accounts return `401` with a sign-in-with-Google message.

### Google Login

`POST /auth/google`

Primary login and registration path. The frontend sends a Google Identity Services ID token; the backend verifies it, links or creates the auth user, creates a session, and returns an AGOS access token.

Request:

```json
{
  "token": "google-id-token"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "expiresIn": 900
}
```

### Refresh

`POST /auth/refresh`

Rotates the refresh token cookie and returns a new access token.

Response:

```json
{
  "accessToken": "jwt",
  "expiresIn": 900
}
```

### Logout

`POST /auth/logout`

Revokes the current session and clears the refresh cookie.

Response:

```json
{
  "success": true
}
```

---

## Organization, Agency, Team

### Create Agency

`POST /organizations/agencies`

Creates an agency tenant and makes the caller an owner.

Request:

```json
{
  "displayName": "Social Expert",
  "slug": "socialexpert"
}
```

Notes:

- `displayName` is used in the UI.
- `slug` is globally unique and used in workspace URLs.

### Get My Memberships

`GET /organizations/me`

Returns the current session's active agency and all memberships for the authenticated user.

### Activate Agency

`POST /organizations/:agencyId/activate`

Sets the target agency as the active agency for the current session.

### Invite Member

`POST /organizations/:agencyId/invitations`

Creates an invitation.

Request:

```json
{
  "email": "editor@example.com",
  "mobileNumber": "+919999999999",
  "roleId": "role-uuid",
  "roleIds": ["role-uuid", "role-uuid-2"]
}
```

### Accept Invitation

`POST /organizations/invitations/:token/accept`

Accepts an invitation and creates an active membership.

### Get Agency Members

`GET /organizations/:agencyId/members`

Returns active members for a specific agency.

### Get Active Agency Members

`GET /organizations/members`

Returns active members for the current agency context.

### Update Member Roles

`PATCH /organizations/:agencyId/members/:membershipId/role`

Changes a member's assigned roles using optimistic locking.

Request:

```json
{
  "roleId": "role-uuid",
  "roleIds": ["role-uuid", "role-uuid-2"],
  "version": 2
}
```

Rules currently enforced in service:

- Owners and managers can change roles.
- Managers cannot change their own role or owner roles.
- Last owner protection applies.
- Target membership must belong to the agency.
- Role IDs must be valid for the agency/system.

### Remove Member

`DELETE /organizations/:agencyId/members/:membershipId?version=2`

Removes a member using optimistic locking.

Rules currently enforced in service:

- Only owners can remove members.
- Owners cannot remove themselves.
- Last owner protection applies.

### Get Roles

`GET /organizations/roles`

Returns system and agency roles for the active agency.

---

## Profile

### Get My Profile

`GET /me/profile`

Returns the authenticated user's profile, status, active membership, and workspace context.

### Update My Profile

`PATCH /me/profile`

Updates editable profile fields.

### Update My Status

`PATCH /me/status`

Updates personal availability/location status.

### Clear My Status

`DELETE /me/status`

Clears the current personal status.

### Get User

`GET /users/:id`

Returns a user profile by ID.

---

## Activation

### Get Activation State

`GET /activation`

Returns derived onboarding progress for the active agency. Values are computed from real data, not stored manually.

Response shape:

```json
{
  "completed": false,
  "progress": 50,
  "steps": {
    "agency": true,
    "team": true,
    "client": true,
    "campaign": false,
    "content": false,
    "workflow": false
  },
  "nextStep": "CREATE_CAMPAIGN"
}
```

---

## Dashboard

### Get Dashboard

`GET /dashboard`

Returns the role-aware dashboard or My Work projection for the active agency.

Current consumers use this for:

- Owner/manager operational dashboard.
- Production-role My Work page.
- Attention queues.
- Latest activity.

---

## Clients

### Create Client

`POST /clients`

Creates a client playbook record under the active agency.

Core request fields:

```json
{
  "name": "Mukunda Jewellery",
  "displayName": "Mukunda",
  "industry": "Fashion",
  "website": "https://example.com",
  "businessDescription": "Premium jewellery brand",
  "businessSize": "Small Business",
  "brandVoice": "Luxury",
  "audience": "Women aged 24-45",
  "competitors": "Competitor A, Competitor B",
  "primaryContactName": "Ananya",
  "primaryContactEmail": "ananya@example.com",
  "preferredContactMethod": "WhatsApp",
  "contentGoals": "Brand Awareness, Sales",
  "approvalSla": "24 Hours",
  "internalNotes": "Agency-only notes"
}
```

The DTO supports the expanded client playbook fields used by create/edit/detail screens.

### List Clients

`GET /clients`

Returns clients in the active agency.

### Get Client

`GET /clients/:id`

Returns one tenant-scoped client with role-filtered details where implemented.

### Update Client

`PATCH /clients/:id`

Updates the same editable model used by Create Client.

### Archive Client

`POST /clients/:id/archive`

Soft-archives a client.

### Restore Client

`POST /clients/:id/restore`

Restores an archived client.

### Assign Client Manager

`POST /clients/:id/assign-manager`

Assigns a manager membership to the client.

Request:

```json
{
  "membershipId": "membership-uuid"
}
```

---

## Campaigns

### Create Campaign

`POST /campaigns`

Creates a campaign planning contract with deliverable plans and optional publishing schedule drafts.

Request:

```json
{
  "clientId": "client-uuid",
  "name": "Festive Bridal Collection",
  "campaignType": "Festival",
  "priority": "High",
  "goal": "Sales",
  "primaryKpi": "Leads",
  "cta": "WhatsApp",
  "objective": "Drive festive enquiries",
  "keyMessage": "Every moment deserves gold",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31",
  "launchDate": "2026-08-05",
  "timezone": "Asia/Kolkata",
  "reviewFrequency": "Weekly",
  "workflowTemplate": "Standard Reel",
  "approvalSla": "24 Hours",
  "revisionLimit": "3",
  "deliverablePlans": [
    {
      "contentType": "REEL",
      "quantity": 8,
      "frequency": "Weekly",
      "preferredDays": "Mon, Wed, Fri",
      "preferredTime": "19:00",
      "platform": "INSTAGRAM"
    }
  ],
  "publishingSchedules": [
    {
      "platform": "INSTAGRAM",
      "scheduledAt": "2026-08-04T13:30:00.000Z",
      "timezone": "Asia/Kolkata"
    }
  ]
}
```

### List Campaigns

`GET /campaigns`

Returns campaigns in the active agency.

### Get Campaign

`GET /campaigns/:id`

Returns the campaign dashboard payload, including campaign summary data used by detail tabs.

### Update Campaign

`PATCH /campaigns/:id`

Updates the full campaign planning model.

### Campaign Lifecycle Commands

All lifecycle commands accept an optional optimistic-lock `version`.

```json
{
  "version": 3
}
```

Endpoints:

- `POST /campaigns/:id/activate`
- `POST /campaigns/:id/pause`
- `POST /campaigns/:id/resume`
- `POST /campaigns/:id/complete`
- `POST /campaigns/:id/archive`
- `POST /campaigns/:id/restore`

---

## Campaign Team

### Get Campaign Team

`GET /campaigns/:id/team`

Returns structured campaign team assignments.

### Assign Campaign Team Member

`POST /campaigns/:id/team`

Request:

```json
{
  "membershipId": "membership-uuid",
  "assignmentRole": "EDITOR"
}
```

Supported assignment roles include:

- `CAMPAIGN_MANAGER`
- `RELATIONSHIP_MANAGER`
- `WRITER`
- `EDITOR`
- `DESIGNER`
- `DOP`
- `SOCIAL_MEDIA_MANAGER`
- `CLIENT_APPROVER`
- `AGENCY_APPROVER`

### Update Campaign Team Assignment

`PATCH /campaigns/:id/team/:assignmentId`

Request:

```json
{
  "membershipId": "membership-uuid",
  "assignmentRole": "DOP",
  "version": 2
}
```

### Remove Campaign Team Assignment

`DELETE /campaigns/:id/team/:assignmentId`

Removes a structured campaign assignment.

---

## Campaign Activity

### Get Campaign Activity

`GET /campaigns/:id/activity`

Returns campaign timeline events such as creation, activation, team changes, publishing changes, and workflow-related campaign events.

---

## Publishing Schedules

### Get Publishing Schedules

`GET /campaigns/:id/publishing-schedules`

Returns the campaign publishing agenda with backend-derived status, risk, and readiness.

### Create Publishing Slot

`POST /campaigns/:id/publishing-schedules`

Request:

```json
{
  "platform": "INSTAGRAM",
  "scheduledAt": "2026-08-04T13:30:00.000Z",
  "timezone": "Asia/Kolkata",
  "contentAssetId": "content-asset-uuid",
  "caption": "Caption draft",
  "note": "Internal note"
}
```

### Update Publishing Slot

`PATCH /campaigns/:id/publishing-schedules/:scheduleId`

Request:

```json
{
  "platform": "YOUTUBE",
  "scheduledAt": "2026-08-05T13:30:00.000Z",
  "timezone": "Asia/Kolkata",
  "contentAssetId": "content-asset-uuid",
  "caption": "Updated caption",
  "note": "Updated note",
  "version": 2
}
```

### Cancel Publishing Slot

`POST /campaigns/:id/publishing-schedules/:scheduleId/cancel`

Request:

```json
{
  "version": 2,
  "cancellationReason": "Client postponed launch"
}
```

### Mark Publishing Slot Published

`POST /campaigns/:id/publishing-schedules/:scheduleId/mark-published`

Request:

```json
{
  "version": 2,
  "publishedUrl": "https://instagram.com/reel/example",
  "publishedAt": "2026-08-04T13:35:00.000Z"
}
```

### Generate Production From Slot

`POST /campaigns/:id/publishing-schedules/:scheduleId/generate-production`

Creates a content asset and first workflow task from a publishing slot.

Request:

```json
{
  "contentType": "REEL",
  "title": "Reel 1",
  "brief": "Create a conversion-focused launch reel.",
  "managerMembershipId": "manager-membership-uuid",
  "writerMembershipId": "writer-membership-uuid",
  "scriptDueAt": "2026-08-05T18:00:00.000Z"
}
```

---

## Content Assets

### Create Content Asset

`POST /content-assets`

Creates a content asset linked to a client and campaign.

Request:

```json
{
  "clientId": "client-uuid",
  "campaignId": "campaign-uuid",
  "displayCode": "REEL-001",
  "type": "REEL",
  "title": "Launch Reel",
  "brief": "Create a launch reel."
}
```

### List Content Assets

`GET /content-assets`

Returns content assets in the active agency.

### Get Content Asset

`GET /content-assets/:id`

Returns one content asset.

### Update Content Asset

`PATCH /content-assets/:id`

Updates content asset planning fields.

### Archive Content Asset

`POST /content-assets/:id/archive`

Soft-archives a content asset.

### Restore Content Asset

`POST /content-assets/:id/restore`

Restores an archived content asset.

---

## Workflow Board

### Get Workflow Board

`GET /workflow/board`

Returns the workflow board read model for the active agency and authenticated user's role/permission scope.

Supports filters used by the frontend:

- search
- client
- campaign
- owner
- risk

---

## Workflow Commands

### Perform Workflow Action

`POST /content-assets/:id/actions`

Preferred command endpoint for the current workflow UI. Uses authenticated request context as the actor.

Request:

```json
{
  "action": "SUBMIT_FOR_REVIEW",
  "idempotencyKey": "uuid-or-command-key",
  "body": "Submission notes",
  "externalLink": "https://drive.google.com/folder/example",
  "comment": "Review comment",
  "reason": "Reason for rejection or blocker"
}
```

Supported actions:

- `SUBMIT_FOR_REVIEW`
- `APPROVE`
- `ACCEPT_HANDOVER`
- `REQUEST_CHANGES`
- `REJECT`
- `BLOCK`
- `UNBLOCK`

### Legacy Workflow Endpoints

The following endpoints are implemented but should be treated as legacy until the security hardening slice removes client-supplied actor identity:

- `POST /content-assets/:id/advance-stage`
- `POST /content-assets/:id/assign`
- `POST /content-assets/:id/submit`
- `POST /content-assets/:id/recall-submission`
- `POST /content-assets/:id/submissions/:submissionId/seen`
- `POST /content-assets/:id/approve`
- `POST /content-assets/:id/request-changes`
- `POST /content-assets/:id/block`
- `POST /content-assets/:id/unblock`

Legacy request bodies commonly include `actorId` and sometimes `workflowTaskId`, `submissionId`, `assigneeId`, `toStage`, `nextStage`, or `returnToStage`.

---

## Gigs / Work Orders

Standalone work assignments for one-off scripts, edits, shoots, designs, research, captions, thumbnails, or overflow work. A gig can be linked to a client but does not require a campaign or campaign team assignment.

### Create Work Order

`POST /work-orders`

Owner, admin, and manager roles only.

Request:

```json
{
  "clientId": "client-uuid",
  "title": "Need 5 IPL meme scripts",
  "description": "Write five short Telugu-English meme scripts for this week's IPL trend.",
  "workType": "SCRIPT",
  "priority": "HIGH",
  "assigneeMembershipId": "writer-membership-uuid",
  "reviewerMembershipId": "manager-membership-uuid",
  "dueAt": "2026-08-09T18:00:00.000Z",
  "estimatedHours": 4,
  "rewardAmount": 1500,
  "rewardCurrency": "INR"
}
```

Emits `WorkOrderCreated`.

### List Work Orders

`GET /work-orders`

Returns gigs visible to the authenticated membership. Owners, admins, and managers see agency gigs. Production roles see gigs where they are the assignee or reviewer.

### Get Work Order

`GET /work-orders/:id`

Returns one visible gig with assignee, reviewer, client, and submissions.

### Update Work Order

`PATCH /work-orders/:id`

Owner, admin, and manager roles only. Updates planning fields and uses optimistic locking via `version`.

Emits `WorkOrderUpdated`.

### Submit Work Order

`POST /work-orders/:id/submit`

Assignee only. At least one of `body` or `externalLink` is required.

Request:

```json
{
  "body": "Draft script notes or handoff details.",
  "externalLink": "https://docs.google.com/document/example"
}
```

Emits `WorkOrderSubmitted`.

### Approve Work Order

`POST /work-orders/:id/approve`

Reviewer, owner, admin, or manager only. The gig must be in `SUBMITTED` state.

Request:

```json
{
  "comment": "Approved. This is ready."
}
```

Emits `WorkOrderApproved`.

### Request Work Order Changes

`POST /work-orders/:id/request-changes`

Reviewer, owner, admin, or manager only. The gig must be in `SUBMITTED` state and `comment` is required.

Request:

```json
{
  "comment": "Make the hook sharper and add one regional reference."
}
```

Emits `WorkOrderChangesRequested`.

---

## Calendar

### Get Calendar Events

`GET /calendar/events`

Returns a role-aware calendar read model for workflow tasks, publishing slots, and standalone work orders.

Query parameters:

- `from`
- `to`
- `scope`: `MY_SCHEDULE`, `MY_ROLE`, `MY_TEAM`, `CAMPAIGN`, `AGENCY`
- `campaignId`
- `memberId`
- `eventTypes`
- `statuses`
- `platforms`

Default scopes:

- Owner: `AGENCY`
- Manager: `MY_TEAM`
- Other roles: `MY_SCHEDULE`

Response shape:

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
    "events": 1,
    "assignedToMe": 1,
    "publishing": 0,
    "overdue": 0
  }
}
```

---

## Files

### Attach External File Link

`POST /files/external-links`

Stores metadata for an external file or folder link such as Google Drive, Frame.io, or Dropbox. The platform does not store media files in V1.

Request:

```json
{
  "agencyId": "agency-uuid",
  "contentAssetId": "content-asset-uuid",
  "workflowTaskId": "workflow-task-uuid",
  "url": "https://drive.google.com/folder/example",
  "label": "Raw footage",
  "provider": "GOOGLE_DRIVE"
}
```

---

## Current Endpoint Inventory

This inventory was generated from controllers on August 1, 2026.

### Implemented

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /organizations/agencies`
- `GET /organizations/me`
- `POST /organizations/:agencyId/invitations`
- `GET /organizations/:agencyId/members`
- `POST /organizations/:agencyId/activate`
- `PATCH /organizations/:agencyId/members/:membershipId/role`
- `DELETE /organizations/:agencyId/members/:membershipId`
- `POST /organizations/invitations/:token/accept`
- `GET /organizations/roles`
- `GET /organizations/members`
- `GET /me/profile`
- `PATCH /me/profile`
- `PATCH /me/status`
- `DELETE /me/status`
- `GET /users/:id`
- `GET /activation`
- `GET /dashboard`
- `POST /clients`
- `GET /clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `POST /clients/:id/archive`
- `POST /clients/:id/restore`
- `POST /clients/:id/assign-manager`
- `POST /campaigns`
- `GET /campaigns`
- `GET /campaigns/:id`
- `PATCH /campaigns/:id`
- `POST /campaigns/:id/archive`
- `POST /campaigns/:id/activate`
- `POST /campaigns/:id/pause`
- `POST /campaigns/:id/resume`
- `POST /campaigns/:id/complete`
- `POST /campaigns/:id/restore`
- `GET /campaigns/:id/team`
- `POST /campaigns/:id/team`
- `PATCH /campaigns/:id/team/:assignmentId`
- `DELETE /campaigns/:id/team/:assignmentId`
- `GET /campaigns/:id/activity`
- `GET /campaigns/:id/publishing-schedules`
- `POST /campaigns/:id/publishing-schedules`
- `PATCH /campaigns/:id/publishing-schedules/:scheduleId`
- `POST /campaigns/:id/publishing-schedules/:scheduleId/cancel`
- `POST /campaigns/:id/publishing-schedules/:scheduleId/mark-published`
- `POST /campaigns/:id/publishing-schedules/:scheduleId/generate-production`
- `POST /content-assets`
- `GET /content-assets`
- `GET /content-assets/:id`
- `PATCH /content-assets/:id`
- `POST /content-assets/:id/archive`
- `POST /content-assets/:id/restore`
- `GET /workflow/board`
- `POST /content-assets/:id/actions`
- `POST /content-assets/:id/advance-stage`
- `POST /content-assets/:id/assign`
- `POST /content-assets/:id/submit`
- `POST /content-assets/:id/recall-submission`
- `POST /content-assets/:id/submissions/:submissionId/seen`
- `POST /content-assets/:id/approve`
- `POST /content-assets/:id/request-changes`
- `POST /content-assets/:id/block`
- `POST /content-assets/:id/unblock`
- `GET /calendar/events`
- `POST /files/external-links`

## Frontend Integration Notes

The frontend uses `src/lib/api-client.ts` to:

- Attach bearer access tokens.
- Attach `X-Agency-Id`.
- Refresh access tokens via `POST /auth/refresh` on `401`.
- Retry the original request once after refresh.
- Standardize JSON/text error extraction.

After login, the frontend calls `GET /organizations/me`:

- If `currentAgency` exists, navigate to `/{agency.slug}`.
- If no agency exists, navigate to `/create-agency`.
- If auth fails, clear local auth state and remain on `/login`.
