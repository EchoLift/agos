---
title: Understanding roles & permissions
description: Understand how roles, assignments, memberships, and client scope control access in AGENCIE.
category: Team & Access
order: 2
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

## How Access Works

AGENCIE uses several layers to decide what a person can see and do.

The most important distinction is:

**Agency Membership**
→ Which agency workspace you belong to

**Role**
→ What capabilities you have inside that agency

**Assignment**
→ Which specific work you are responsible for

**Client Association**
→ Which business client a CLIENT user represents

These concepts work together but serve different purposes.

## Agency Membership

A membership connects your AGENCIE account to an agency.

For example:

Surya
→ Agency A membership
→ Manager

Surya
→ Agency B membership
→ Editor

The same account can belong to multiple agencies, but each membership is separate.

Access in one agency does not grant access to another.

## Roles

Roles describe a person's responsibilities and capabilities inside an agency.

AGENCIE supports roles such as:

### OWNER

The Owner has the highest level of agency management access.

Owner capabilities include broader workspace administration, Team management, role management, invitations, and member removal.

Owner access also has additional protections around role and membership changes.

### ADMIN

Admin supports agency administration and operational management.

Admins can perform permitted administrative actions such as managing invitations, but do not automatically receive every Owner-only capability.

### MANAGER

Managers coordinate production and team operations.

Depending on the feature, Managers can perform actions such as creating and managing operational work, inviting team members, and managing permitted role changes.

Managers do not automatically receive every Owner or Admin capability.

### WRITER

Writers perform writing-related production work when assigned.

Typical work can include scripts, captions, copy, and other writing tasks.

### DOP

DOP users handle production and shoot-related work when assigned.

### EDITOR

Editors handle editing-related production work and relevant production handovers when assigned.

### DESIGNER

Designers handle design-related assignments and production work where supported.

### SOCIAL_MEDIA_MANAGER

Social Media Managers work with relevant social and publishing operations where permitted.

### MEMBER

Member represents basic internal agency access without the specialized capabilities provided by higher or production-specific roles.

### CLIENT

CLIENT represents an external user associated with a business client.

CLIENT access is scoped differently from normal internal agency roles.

A CLIENT-only user is associated with a specific business client and should only receive the client-facing access available for that business.

## Multiple Roles

A person can have more than one internal role.

For example:

Writer + Editor

or:

DOP + Editor

AGENCIE combines the capabilities available through the person's internal roles where supported.

This allows one person to perform multiple functions without requiring separate accounts.

## Role Does Not Mean Assignment

Having a role does not automatically assign matching work.

For example:

Writer
→ Can perform writing work

Writer assigned to Task A
→ Responsible for Task A

Another Writer
→ May have the same role but does not own Task A

Actual responsibility depends on assignments such as:

- Workflow task ownership
- Gig assignment
- Reviewer assignment
- Campaign participation

> [!IMPORTANT] Role vs Assignment
> A role determines what kind of work you can perform. An assignment determines which specific work you are responsible for.

## Campaign Team

Being part of a campaign team provides campaign context and responsibility within that campaign.

It does not automatically make someone the owner of every workflow task associated with the campaign.

For example:

Campaign Team
→ Writer: Maya
→ Editor: Arun

Workflow Task
→ Current owner: Maya

When the workflow reaches editing, ownership can move to the appropriate assigned editor.

## CLIENT Scope

CLIENT is different from internal agency roles.

A CLIENT membership is associated with a specific business client.

For example:

Agency
→ Client A
→ CLIENT User A

That user should not receive access to Client B simply because both clients belong to the same agency.

Client association therefore acts as an additional access boundary.

## CLIENT With Internal Roles

A person can also have CLIENT together with legitimate internal roles where required.

For example:

Editor + CLIENT

In this situation, AGENCIE preserves the access provided by the person's internal agency role.

The CLIENT association does not automatically reduce an internal employee to client-only access.

A CLIENT-only membership, however, remains scoped to the associated business client.

## Viewing vs Managing

Being able to see something does not automatically mean you can modify it.

For example, some internal roles can use Team as a read-only directory.

They may see:

- Team members
- Roles
- Basic team information

while not being allowed to:

- Invite members
- Edit roles
- Remove members
- Manage invitations

AGENCIE separates visibility from management capabilities.

## Permissions Are Contextual

An action can depend on more than the user's role.

AGENCIE can also consider:

- Active agency
- Membership status
- Resource ownership
- Client scope
- Assignment
- Current workflow state
- Current Gig state

For example, an Editor may have permission to perform editing work but still cannot act on a task assigned to another Editor.

## Workspace Navigation

AGENCIE adapts workspace navigation according to the current user's access.

Different roles may therefore see different sections of the same agency workspace.

Missing navigation does not necessarily mean the workspace is broken.

It can mean that the current membership does not have access to that area.

## Backend Enforcement

AGENCIE does not rely only on the interface to enforce permissions.

Hiding a button or navigation item improves the user experience, but protected operations are also checked by the backend.

Directly opening a protected URL does not grant additional access.

> [!IMPORTANT] Access Model
> Think about AGENCIE access using four questions:
>
> **Which agency do I belong to?**
> → Membership
>
> **What am I allowed to do?**
> → Roles and permissions
>
> **Which work is mine?**
> → Assignments
>
> **Which business can I access as a client user?**
> → Client association