# Development Methodology

AGENCIE is built by following two complementary methodologies:

- Lean Startup
- Kanban

These are product development principles, not just project management techniques.

Every implementation must align with them.

---

# Lean Principles

We optimize for learning over shipping features.

Every feature must answer one question:

> "Does this solve a real problem for agency founders?"

If the answer is unknown, build the smallest possible implementation.

Never build speculative functionality.

Prefer iteration over completeness.

## Lean Rules

- Build the MVP first.
- Deliver vertical slices.
- Validate with real agencies.
- Measure actual usage.
- Improve based on feedback.
- Avoid premature optimization.
- Avoid feature creep.
- Avoid enterprise complexity unless justified.
- Every feature must provide immediate business value.

Ask before implementing:

- Is this solving a real workflow problem?
- Can this be implemented simpler?
- Can this wait until later?
- Does this reduce founder workload?
- Would an agency pay for this?

If not, don't build it.

---

# Kanban Principles

Development follows a continuous delivery model.

There are no fixed sprints.

Features move through the workflow one by one.

Visualize all work.

Limit Work In Progress (WIP).

Finish before starting something new.

Never have multiple partially completed modules.

---

## Kanban Workflow

Backlog

↓

Ready

↓

Design

↓

Implementation

↓

Testing

↓

Review

↓

Done

Every task should exist in exactly one stage.

---

## WIP Limits

Maximum active module:

1

Maximum active feature:

1

Maximum active architectural change:

1

Finish current work before starting another.

---

# Vertical Slice Development

Every feature must be completed end-to-end.

Never leave unfinished layers.

Every slice includes:

- Database
- Repository
- Service
- Controller
- DTO Validation
- Tests
- Swagger
- Domain Events
- Documentation

Only then is the feature considered Done.

---

# Definition of Done

A feature is NOT complete until:

- Business rules implemented
- Tests passing
- Build passing
- Swagger updated
- Domain events emitted
- Logging added
- Error handling completed
- Security reviewed
- Documentation updated

---

# Decision Hierarchy

When multiple implementations are possible, choose the one that follows this priority:

1. Simplicity
2. Maintainability
3. Readability
4. Security
5. Scalability
6. Performance

Never sacrifice simplicity for theoretical scalability.

Scale only when required.

---

# AI Agent Expectations

When writing code:

- Think like a senior software engineer.
- Follow existing architecture.
- Respect module boundaries.
- Never duplicate business logic.
- Prefer extending existing modules over creating new ones.
- Keep controllers thin.
- Keep repositories database-focused.
- Keep business logic inside services.
- Emit domain events for every write operation.
- Follow optimistic locking.
- Use transactions for consistency.
- Write unit tests.
- Update Swagger.
- Update documentation.
- Keep implementations Lean.
- Avoid over-engineering.
- Complete one vertical slice before moving to the next.

If there is uncertainty, prefer the simplest implementation that satisfies today's requirements while keeping tomorrow's evolution possible.


# AGENCIE Design Philosophy

AGENCIE is not a generic project management platform.

It is an operating system for creative agencies.

Every feature must reduce operational chaos.

The platform should:

- Reduce context switching.
- Reduce founder micromanagement.
- Reduce manual follow-ups.
- Increase ownership.
- Increase visibility.
- Push work to users through notifications and calendars instead of requiring users to constantly check the application.

When deciding whether to build a feature, ask:

"Does this help an agency deliver content faster with less operational overhead?"

If not, reconsider whether it belongs in AGENCIE.