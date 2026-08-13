# Role-Aware Calendar - 2026-08-01

## Goal

Add a Microsoft Teams-style operational calendar where assigned work appears like a meeting invite, while broader agency views are available only when the user has permission.

## Backend Endpoint

`GET /api/v1/calendar/events`

Supported query parameters:

- `from`
- `to`
- `scope`
- `campaignId`
- `memberId`
- `eventTypes`
- `statuses`
- `platforms`

Scopes:

- `MY_SCHEDULE`
- `MY_ROLE`
- `MY_TEAM`
- `CAMPAIGN`
- `AGENCY`

Default scope:

- Owner: `AGENCY`
- Manager: `MY_TEAM`
- Other roles: `MY_SCHEDULE`

## Event Sources

The calendar is a read model. It does not own workflow or publishing state.

Current sources:

- `WorkflowTask.deadlineAt`
- `PublishingSchedule.scheduledAt`

Calendar event categories:

- `WORKFLOW_TASK`
- `SHOOT`
- `REVIEW`
- `APPROVAL`
- `PUBLISHING`
- `CAMPAIGN_MILESTONE`
- `CLIENT_MEETING`
- `TEAM_EVENT`

## Access Rules

- Every query is tenant-scoped by `agencyId`.
- `MY_SCHEDULE` returns direct assignments first.
- `MY_ROLE` returns tasks assigned to members with the same role keys.
- `MY_TEAM` returns campaigns where the current member is campaign manager or relationship manager.
- `CAMPAIGN` requires access to that campaign.
- `AGENCY` requires owner or manager access.
- Filtering another member's calendar requires owner or manager access.
- Publishing slots in `MY_SCHEDULE` are returned only when the member is assigned as `SOCIAL_MEDIA_MANAGER` for the campaign.

## Frontend

Added workspace route:

`/[agencySlug]/calendar`

Visual calendar layer:

- `@ilamy/calendar`
- `dayjs`

The Calendar page includes:

- scope filter
- campaign filter
- date range
- visible calendar toggles
- month/week/day/year visual calendar
- agenda view
- summary cards
- reset to role defaults

Visibility preferences are stored locally in:

`agos.calendar.visibleTypes`

This is a display preference only. Backend permission filtering remains authoritative.

`@ilamy/calendar` is used only as a rendering layer. AGENCIE still owns:

- role-aware event filtering
- tenant isolation
- workflow and publishing state
- event readiness and risk
- permissions

## Rule

Show people what they need by default, allow them to reveal more, and never expose what they are not authorized to see.
