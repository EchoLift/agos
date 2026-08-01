# API Contract

Date: July 20, 2026

## Purpose

This document defines the first backend API contract for Agency OS.

Every endpoint should define:

- Auth rule
- Permission rule
- Idempotency behavior
- Emitted events

## Global Rules

Base path:

```text
/api/v1
```

Every protected request must include:

```text
Authorization: Bearer <access-token>
X-Request-Id: <uuid>
```

For mutation endpoints that may be retried:

```text
Idempotency-Key: <stable-key>
```

The gateway should generate `X-Request-Id` if the client does not send it.

## Auth

### Register

```text
POST /auth/register
```

Emits:

```text
UserRegistered
```

Notes:

- Stores encrypted email.
- Stores email lookup hash.
- Stores Argon2id password hash.

### Login

```text
POST /auth/login
```

Notes:

- Uses email lookup hash.
- Returns access token.
- Sets refresh token as HttpOnly cookie.

### Google Login

```text
POST /auth/google
```

Recommended login and registration method for the SPA frontend.

Request:

```json
{
  "token": "google-id-token"
}
```

Backend behavior:

- Verify ID token using `google-auth-library`.
- Validate audience with `GOOGLE_CLIENT_ID`.
- Require verified email.
- Find user by Google provider identity.
- If not found, find user by `emailHash` and link a Google provider identity.
- If still not found, create Google-only auth identity.
- Create normal session and refresh token.

Emits:

```text
UserRegistered
AuthProviderLinked
UserLoggedIn
```

### Refresh

```text
POST /auth/refresh
```

Notes:

- Requires `refreshToken` HttpOnly cookie.
- Detects token reuse and revokes entire family if compromised.
- Rotates refresh token (sets new cookie).
- Returns new access token.

### Logout

```text
POST /auth/logout
```

Notes:

- Requires `refreshToken` HttpOnly cookie.
- Revokes current session.
- Clears the refresh token cookie.

## Organization

### Create Agency

```text
POST /organizations/agencies
```

Emits:

```text
AgencyCreated
```

## Clients

### Create Client

```text
POST /clients
```

Permission:

```text
client.create
```

Emits:

```text
ClientCreated
```

### Get Client

```text
GET /clients/:id
```

Permission:

```text
client.view
```

Agency isolation:

- User must belong to the same agency as the client.

## Campaigns

### Create Campaign

```text
POST /campaigns
```

Permission:

```text
campaign.create
```

Emits:

```text
CampaignCreated
```

## Content Assets

### Create Content Asset

```text
POST /content-assets
```

Permission:

```text
content.create
```

Backend behavior:

- Generates `displayCode` automatically.
- Creates `ContentAsset`.
- Creates `WorkflowInstance`.
- Creates first `WorkflowTransition`.

Emits:

```text
ContentAssetCreated
```

### Get Content Asset

```text
GET /content-assets/:id
```

Permission:

```text
content.view
```

Response should include:

- Content asset
- Active workflow instance
- Tasks
- Transitions
- Assignment history
- Submissions
- Approvals
- Active blockers
- File links

### Assign Content

```text
POST /content-assets/:id/assign
```

Permission:

```text
content.assign
```

Backend behavior:

- Updates current owner.
- Updates current stage.
- Creates `AssignmentHistory`.
- Creates `WorkflowTransition`.
- Creates `WorkflowTask`.

Emits:

```text
ContentAssigned
WorkflowStageChanged
```

### Submit Work

```text
POST /content-assets/:id/submit
```

Permission:

```text
submission.create_own
```

Guard:

- Actor must be current owner.

Backend behavior:

- Auto-increments submission version per asset and submission type.

Emits:

```text
SubmissionCreated
```

### Recall Submission

```text
POST /content-assets/:id/recall-submission
```

Permission:

```text
submission.recall_own
```

Guard:

- Actor must be submitter.
- Submission must not be seen.
- Submission status must be `SUBMITTED`.

Emits:

```text
SubmissionRecalled
```

### Approve

```text
POST /content-assets/:id/approve
```

Permission:

```text
approval.create
```

Idempotency:

- Required before production.
- Current schema supports `idempotencyKey`.

Emits:

```text
ApprovalGranted
ContentAssigned
WorkflowStageChanged
```

### Request Changes

```text
POST /content-assets/:id/request-changes
```

Permission:

```text
approval.request_changes
```

Backend behavior:

- Creates approval record with `CHANGES_REQUESTED`.
- Moves asset back to return owner/stage.
- Creates assignment and transition history.

Emits:

```text
ChangesRequested
ContentAssigned
WorkflowStageChanged
```

### Block

```text
POST /content-assets/:id/block
```

Permission:

```text
content.block
```

Emits:

```text
BlockerRaised
```

### Unblock

```text
POST /content-assets/:id/unblock
```

Permission:

```text
content.unblock
```

Emits:

```text
BlockerResolved
```

## Files

### Attach External Link

```text
POST /files/external-links
```

Permission:

```text
file.attach
```

Notes:

- V1 stores external links, not heavy media files.
- Raw footage and final cuts can remain in Google Drive initially.
