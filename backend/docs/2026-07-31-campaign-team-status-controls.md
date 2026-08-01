# Campaign Team And Status Controls

Date: 2026-07-31

## Goal

Make Campaign operational by adding:

- explicit campaign team responsibilities
- status-aware lifecycle controls

Campaign now answers not only what is being planned, but also who owns the campaign and what state it is in.

## Structured Team Assignments

Added `CampaignTeamAssignment`.

Each assignment links:

- agency
- campaign
- membership
- campaign responsibility

Supported assignment roles:

- Campaign Manager
- Relationship Manager
- Writer
- Editor
- Designer
- DOP
- Social Media Manager
- Client Approver
- Agency Approver

Single-owner responsibility rules:

- only one Campaign Manager per campaign
- only one Relationship Manager per campaign

Pool roles can have multiple members:

- writers
- editors
- designers
- DOP

## Team APIs

- `GET /api/v1/campaigns/:id/team`
- `POST /api/v1/campaigns/:id/team`
- `PATCH /api/v1/campaigns/:id/team/:assignmentId`
- `DELETE /api/v1/campaigns/:id/team/:assignmentId`

Business rules:

- target membership must belong to the same agency
- target membership must be active
- only owner or manager can manage campaign team assignments
- duplicate role/member assignments are rejected

Events:

- `CampaignTeamMemberAssigned`
- `CampaignTeamMemberRemoved`
- `CampaignManagerChanged`

## Status Controls

Campaign lifecycle commands are explicit:

- activate
- pause
- resume
- complete
- archive
- restore

Allowed transitions:

- `DRAFT -> ACTIVE`
- `ACTIVE -> PAUSED`
- `PAUSED -> ACTIVE`
- `ACTIVE -> COMPLETED`
- `ACTIVE -> ARCHIVED`
- `PAUSED -> ARCHIVED`
- `COMPLETED -> ARCHIVED`
- `ARCHIVED -> ACTIVE`

Invalid transitions are rejected.

Completion is blocked while deliverables are unfinished.

All status writes use optimistic locking with campaign `version`.

Events:

- `CampaignActivated`
- `CampaignPaused`
- `CampaignResumed`
- `CampaignCompleted`
- `CampaignArchived`
- `CampaignRestored`

## Frontend Changes

Campaign detail page now includes:

- status-aware header actions
- structured campaign team card
- `Manage Team` panel
- grouped responsibility display
- confirmation before removing assignments

Owners and managers can manage team and lifecycle controls.

Other roles continue to see production context without internal controls.

## Verification

- Prisma schema validation passed.
- Prisma client generation passed.
- Local database synced with Prisma schema.
- Backend build passed.
- Campaign service tests passed.
- Frontend lint passed with existing image warnings only.
- Frontend production build passed.
