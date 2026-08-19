---
title: Permission denied
description: Understand why AGENCIE blocks access to a page, record, or action.
category: Troubleshooting
order: 5
roles:
  - OWNER
  - ADMIN
  - MANAGER
  - WRITER
  - DOP
  - EDITOR
  - DESIGNER
  - SOCIAL_MEDIA_MANAGER
  - MEMBER
  - CLIENT
status: AVAILABLE
---

## Why It Happens

AGENCIE checks access before allowing you to view data or perform an action.

Access can depend on:

- Your active agency membership
- Your assigned roles
- The permissions provided by those roles
- The workspace you are currently using
- The client or resource you are trying to access
- Your assignment to the work
- The current state of the workflow or Gig

Having access to a page does not automatically mean you can perform every action on that page.

## Common Examples

You may receive a permission error when:

- A production role tries to use management-only controls.
- A user tries to edit agency settings without the required access.
- A read-only Team user tries to invite, edit, or remove members.
- A user tries to perform a workflow action they do not own or review.
- A user opens another agency's workspace without an active membership.
- A CLIENT user tries to access data belonging to another business client.
- An action is not available to your role in the current state of the work.

## Read-Only Access

Some areas of AGENCIE intentionally allow broader visibility while restricting actions.

For example, internal employees may be able to view the **Team** directory without being able to:

- Invite members
- Edit roles
- Remove members
- Manage invitations

Seeing information and being allowed to modify it are separate permissions.

## CLIENT Access

CLIENT users have an additional business-client boundary.

A CLIENT-only membership is associated with a specific business client.

The user can access only the client data and supported resources allowed for that business client.

Trying to directly open another client's campaign, calendar, workflow, or other protected resource does not bypass this restriction.

AGENCIE should reject unauthorized access even when the user knows the direct URL.

## Multiple Roles

If you have multiple internal roles, AGENCIE combines the access available through those roles where supported.

For example:

Writer + Editor
→ Can use the appropriate capabilities available to both roles

Having CLIENT together with a legitimate internal agency role does not automatically reduce that employee to CLIENT-only access.

## What To Do

First check:

1. You are in the correct agency workspace.
2. Your membership in that agency is active.
3. You have the expected role.
4. The resource belongs to the agency or business client you are allowed to access.
5. The work is actually assigned to you when the action requires assignment.
6. The action is valid for the current workflow or Gig state.

If your responsibilities have changed and you genuinely need additional access, contact an authorized agency administrator to review your roles.

Do not add a higher role only to bypass an unexpected permission error. Confirm that the additional access is actually required for the person's responsibilities.

## 403 And 404 Responses

When access is denied, AGENCIE may respond with a forbidden or unavailable result depending on the resource and security boundary.

This prevents users from relying on direct URLs to access information outside their permitted scope.

> [!IMPORTANT] Security Is Enforced Server-Side
> AGENCIE does not rely only on hidden navigation items or disabled buttons. Protected operations and resources are also checked by the backend. Manually entering a protected URL does not grant access.