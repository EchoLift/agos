# Campaign Module Enhancement

Date: 2026-07-31

## Goal

Transform Campaign from a simple planning record into the operational contract between a client and the agency.

Campaign now owns planning intent:

- what the campaign is trying to achieve
- when it runs
- which deliverables are expected
- which workflow template and approval rules apply
- how publishing should be planned

Production execution remains outside Campaign:

- Content Assets represent actual work items
- Workflow Instances and Tasks represent production state
- Publishing Schedule represents when and where approved work goes live

## Backend Changes

Expanded `Campaign` with planning fields:

- campaign code
- campaign type
- priority
- goal
- primary KPI
- CTA
- audience override behavior
- launch date
- review frequency
- working days
- timezone
- workflow template
- approval SLA
- revision limit
- references and internal notes
- content calendar preferences

Added structured campaign planning models:

- `CampaignDeliverablePlan`
- `PublishingSchedule`

Added publishing enums:

- `PublishingPlatform`
- `PublishingStatus`

Campaign display codes are generated automatically as `CMP-###`. The database still uses UUIDs internally.

## Frontend Changes

Create and edit now share the same campaign form model through `CampaignPlanForm`.

The campaign form is split into sections:

- Overview
- Timeline
- Strategy
- Deliverables
- Workflow & Approvals
- Content Calendar
- References & Internal

Campaign detail now renders as an operational dashboard instead of a plain form page. It includes:

- campaign header
- status and campaign code
- progress summary
- content metrics
- timeline
- strategy
- deliverables
- team
- workflow rules
- publishing calendar
- references
- internal notes

## Boundaries Preserved

Campaign defines the plan.

Content Assets define what is produced.

Workflow defines how production moves.

Publishing Schedule defines when and where content goes live.

This prevents Campaign from becoming a dumping ground for workflow history, approval logs, and publishing execution.

## Verification

- Backend campaign unit tests passed.
- Backend build passed.
- Frontend lint passed with existing image optimization warnings only.
- Frontend production build passed.
