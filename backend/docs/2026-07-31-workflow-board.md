# 2026-07-31 Workflow Board

## Goal

Move Workflow from a content table to an operations board that answers:

- What is being produced?
- Where is it now?
- Who owns it?
- What is blocking it?
- What should happen next?

## Backend

- Added `GET /api/v1/workflow/board`.
- The endpoint returns a tenant-scoped workflow board read model.
- The board groups items by production stage.
- The board derives summary counts:
  - active
  - waiting review
  - blocked
  - overdue
  - due today
- The read model includes:
  - content code
  - title
  - type
  - client
  - campaign
  - owner
  - manager
  - deadline
  - risk
  - task status
  - submission status
  - approval status
  - blocker state
  - last activity
- Supported filters:
  - client
  - campaign
  - owner
  - risk
  - search
- Content assets without an active workflow instance are shown in the `IDEA` column so older/simple content does not disappear from operations.

## Frontend

- Replaced the old Workflow table with a board-first view.
- Added summary cards above the board.
- Added filters for search, client, campaign, owner, and risk.
- Added stage columns with operational cards.
- Added a right-side detail drawer for quick inspection.
- The drawer shows ownership, manager, deadline, status, submission state, and suggested next action.
- Full detail page remains available through `Open full details`.

## Product Boundary

- No drag-and-drop in this slice.
- No stage mutation from the board in this slice.
- Movement stays backend-controlled so workflow rules remain real.
