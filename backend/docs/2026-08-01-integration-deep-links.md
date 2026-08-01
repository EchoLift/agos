# 2026-08-01 - Integration Deep Links

AGOS screens should not render operational records as dead cards.

## Rule

Every visible workflow-related item should open the most useful source-of-truth view:

- Workflow task -> workflow detail
- Calendar event with content -> workflow detail
- Calendar event without content but with campaign -> campaign detail
- Campaign content item -> workflow detail
- Campaign publishing slot with linked content -> workflow detail
- Campaign row -> campaign detail
- Content row -> content detail
- Dashboard task/activity -> workflow detail

## Reason

Campaign, content, workflow, calendar, activity, and dashboard views are different lenses over the same production system. A child update should be reachable from every parent view without forcing the user to search again.
