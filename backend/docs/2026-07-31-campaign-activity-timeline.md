# Campaign Activity Timeline

Date: 2026-07-31

## Goal

Expose campaign history visibly so founders and managers can understand what changed, who changed it, and when.

The campaign page now moves beyond current state and shows an operational timeline.

## Backend

Added:

- `GET /api/v1/campaigns/:id/activity`

The endpoint reads campaign-related domain events from `OutboxEvent`.

It supports both:

- new events with `aggregateType = Campaign` and `aggregateId = campaignId`
- older campaign events where `campaignId` exists inside the event payload

The read model enriches:

- actor name
- assigned member name
- event message
- event metadata

Timeline events currently include:

- campaign created
- campaign updated
- campaign activated
- campaign paused
- campaign resumed
- campaign completed
- campaign archived
- campaign restored
- campaign manager changed
- campaign team member assigned
- campaign team member removed

## Event Hygiene

Campaign event publishes now include:

- `aggregateId: campaign.id`
- `aggregateType: Campaign`

This makes future campaign activity queries cleaner and faster.

## Frontend

Campaign detail page now includes an `Activity` section.

The timeline refreshes after:

- campaign edit
- activation
- pause
- resume
- complete
- archive
- restore
- team assignment changes

Each activity item shows:

- event message
- timestamp
- actor name when available

## Verification

- Backend build passed.
- Campaign service tests passed.
- Frontend lint passed with existing image warnings only.
- Frontend production build passed.
