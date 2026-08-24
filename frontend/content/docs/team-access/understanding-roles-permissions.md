---
title: Understanding roles & permissions
description: Understand how roles, assignments, memberships, client access, and Primary Contact responsibilities control access in AGENCIE.
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

The most important distinctions are:

**Agency Membership**
→ Which agency workspace you belong to

**Role**
→ What capabilities you have inside that agency

**Assignment**
→ Which specific work you are responsible for

**Client Access**
→ Which business clients a CLIENT user can access

**Primary Contact**
→ Which CLIENT user is the main communication recipient for a business client

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

CLIENT enables supported client-facing access.

Unlike normal internal roles, CLIENT works together with explicit client access.

A CLIENT user can be given access to one or more business clients.

For example:

Maya
→ CLIENT
→ Client A
→ Client B

Maya can receive supported client-facing access for Client A and Client B but does not automatically receive access to Client C.

## Multiple Roles

A person can have more than one role.

For example:

Writer + Editor

DOP + Editor

Editor + CLIENT

AGENCIE combines the capabilities available through the person's roles where supported.

This allows one person to perform multiple functions without requiring separate accounts.

CLIENT additionally uses explicit client access to determine which business clients are available to that user.

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

The CLIENT role enables client-facing capabilities, while **client access** determines which business clients the person can access.

For example:

Agency
├── Client A
│   ├── Maya
│   └── Arun
│
└── Client B
    ├── Arun
    └── Priya

Maya
→ CLIENT access to Client A

Arun
→ CLIENT access to Client A and Client B

Priya
→ CLIENT access to Client B

Arun can therefore participate in supported client-facing areas for both clients without requiring separate agency memberships.

Client access to one business does not grant access to every business managed by the agency.

## Primary Contact

Primary Contact is separate from roles and client access.

A business client can have multiple CLIENT users but one user can be designated as its **Primary Contact**.

For example:

Client A
├── Maya — CLIENT + Primary Contact
├── Arun — CLIENT
└── Priya — CLIENT

All three users can have supported access to Client A.

Maya is additionally the client's main communication recipient.

For supported automated client-facing notifications:

Maya
→ Receives the email

Arun
→ No automated client email

Priya
→ No automated client email

Arun and Priya keep their permitted portal access.

Primary Contact therefore controls communication ownership rather than access level.

## Primary Contact Is Not A Role

Primary Contact does not appear as another agency role alongside Writer, Editor, CLIENT, or Manager.

It is a relationship between:

Business Client
→ CLIENT User

A user must have CLIENT access to the relevant business client to serve as its Primary Contact.

Being Primary Contact does not:

- Grant internal agency permissions
- Grant access to additional business clients
- Override resource permissions
- Automatically assign workflow work
- Replace the CLIENT role

It identifies who represents the client's main communication endpoint inside AGENCIE.

## Primary Contact Protection

Because Primary Contact is tied to a CLIENT user, AGENCIE protects that relationship during access changes.

If a user is Primary Contact for a business client, AGENCIE blocks changes that would remove the access required by that relationship.

This includes attempting to:

- Remove their access to that client
- Remove their CLIENT role
- Remove their agency membership

The Primary Contact must first be reassigned to another eligible CLIENT user.

For example:

Client A
→ Maya — Primary Contact

To remove Maya's Client A access:

Client A
→ Assign Arun as Primary Contact
→ Maya remains CLIENT temporarily
→ Remove Maya's Client A access

Changing Primary Contact does not automatically remove the previous user's client access.

> [!IMPORTANT] Primary Contact Protection
> Reassign Primary Contact before removing the current Primary Contact's CLIENT access, CLIENT role, or agency membership.

## CLIENT With Internal Roles

A person can have CLIENT together with legitimate internal roles where required.

For example:

Editor + CLIENT

In this situation, AGENCIE preserves the access provided by the person's internal agency role.

The CLIENT role does not automatically reduce an internal employee to client-only access.

For example:

Editor + CLIENT
→ Editor capabilities according to agency permissions
→ Client-facing access according to assigned client access

A CLIENT-only external user, however, receives only the supported client-facing access available through CLIENT.

## Client Access vs Primary Contact

These concepts answer different questions.

**CLIENT role**
→ Can this person use client-facing capabilities?

**Client access**
→ Which business clients can this person access?

**Primary Contact**
→ For which business client is this person the main communication recipient?

For example:

Maya
→ CLIENT
→ Client A — Primary Contact
→ Client B — Access only

Maya can access both clients.

She receives Primary Contact communication for Client A.

She does not receive Primary Contact communication for Client B.

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
- Client access
- Primary Contact responsibilities
- Assignment
- Current workflow state
- Current Gig state

For example, an Editor may have permission to perform editing work but still cannot act on a task assigned to another Editor.

Similarly, an Owner may normally be allowed to remove a CLIENT user but cannot remove that user while they remain Primary Contact for a business client.

## Workspace Navigation

AGENCIE adapts workspace navigation according to the current user's access.

Different roles may therefore see different sections of the same agency workspace.

For example, a CLIENT user with valid client access can receive supported client-facing navigation such as Files.

Removing CLIENT access can remove those client-facing navigation capabilities.

Missing navigation does not necessarily mean the workspace is broken.

It can mean that the current membership does not have access to that area.

## Backend Enforcement

AGENCIE does not rely only on the interface to enforce permissions.

Hiding a button or navigation item improves the user experience, but protected operations are also checked by the backend.

Directly opening a protected URL does not grant additional access.

Client isolation and Primary Contact protection are therefore enforced beyond the visible interface.

> [!IMPORTANT] Access Model
> Think about AGENCIE access using five questions:
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
> **Which business clients can I access?**
> → Client access
>
> **Who receives official automated communication for a client?**
> → Primary Contact