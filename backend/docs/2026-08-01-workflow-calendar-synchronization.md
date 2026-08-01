# Workflow Calendar Synchronization - 2026-08-01

## Goal

Synchronize Campaign, Publishing Calendar, Content, Workflow, Calendar, Activity, and Notifications around one source of truth.

Campaign represents the client commitment.

PublishingSchedule represents when and where the client-facing deliverable goes live.

WorkflowInstance and WorkflowTask represent production progress.

Calendar is a visual projection of workflow and publishing dates. It does not own production state.

## Implemented Slice

### Publishing Slot Generates Production

New command:

`POST /api/v1/campaigns/:campaignId/publishing-schedules/:scheduleId/generate-production`

This command:

1. Validates owner/manager access.
2. Validates the publishing slot belongs to the campaign and agency.
3. Resolves the campaign manager from `CampaignTeamAssignment.CAMPAIGN_MANAGER`, falling back to the actor membership.
4. Resolves the writer from `CampaignTeamAssignment.WRITER`.
5. Creates a linked `ContentAsset`.
6. Creates a `WorkflowInstance`.
7. Creates the first `WorkflowTask` for script writing.
8. Links the `PublishingSchedule` to the generated content asset.
9. Writes assignment history.
10. Writes outbox events and an in-app notification in the same transaction.

Events emitted:

- `ContentAssetCreated`
- `ContentAssigned`
- `PublishingSlotProductionGenerated`

### Automatic Workflow Progress

When `approve()` is called without explicit next-stage fields, the workflow now attempts to auto-advance based on the campaign team:

- `WRITING` approval creates a `SHOOT` task for the campaign DOP.
- `SHOOT` approval creates an `EDITOR_INTAKE` task for the campaign editor.
- `EDITOR_INTAKE` approval creates an `EDITING` task for the campaign editor.
- `EDITING` approval completes the workflow and marks the linked publishing slot `READY`.

If the required campaign role is missing, the approval fails with a clear message instead of creating unowned work.

Explicit next-stage fields still work and take precedence.

### Notifications

In-app notifications are created for:

- task assignment
- generated writing task
- submission received by manager
- changes requested
- auto-created next craft tasks

Delivery channels remain in-app for this slice. Email, WhatsApp, and Google Calendar sync remain future delivery layers.

## Source Of Truth Rules

- Campaign defines the promise to the client.
- PublishingSchedule anchors production deadlines.
- ContentAsset is the business deliverable.
- WorkflowInstance and WorkflowTask own production progress.
- Calendar reads workflow tasks and publishing slots.
- Notifications react to workflow and campaign events.
- Activity Timeline reads outbox events.

No module should store duplicate production status.

## Deadline Rules

Default deadlines are derived from the publishing time:

- Script: 4 days before publishing, 6 PM
- Shoot: 2 days before publishing, 6 PM
- Editor intake: 1 day before publishing, 12 PM
- Editing: 1 day before publishing, 6 PM

Managers can still override deadlines through explicit workflow assignment and approval payloads.

## Frontend

Campaign Calendar now shows `Generate Production` for unlinked publishing slots.

The action:

- prompts for content title
- infers a content type
- calls the production-generation endpoint
- refreshes Campaign, Publishing Agenda, and Activity

After generation, the content appears in:

- Campaign content list
- Workflow board
- Calendar
- Activity timeline
- Notifications for the assigned writer

## Future Work

- Dedicated production-generation drawer instead of prompt.
- Explicit DOP/editor deadline editing before generation.
- Footage handoff acceptance command.
- Ready-to-publish review state refinement.
- Notification delivery fanout through `NotificationDelivery`.
- Google Calendar sync from the same calendar read model.
