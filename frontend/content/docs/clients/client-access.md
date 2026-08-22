---
title: Client access
description: Understand how external client users access AGENCIE and how their workspace is scoped.
category: Clients
order: 5
roles:
  - OWNER
  - ADMIN
  - MANAGER
  - CLIENT
status: AVAILABLE
---

## What It Is

AGENCIE allows external client users to access the agency workspace using the **CLIENT** role.

A CLIENT user represents a specific business client your agency works with.

Their access is scoped to that business client rather than the agency's complete client portfolio.

## Business Client vs CLIENT User

These are separate concepts in AGENCIE.

**Business Client**
→ The company or brand your agency works with

**Client Contact**
→ A person associated with that business

**CLIENT User**
→ A person with an AGENCIE account whose membership is associated with that business client

A business client can exist without giving anyone external access to AGENCIE.

## Inviting A Client User

A CLIENT user can be invited by assigning the **CLIENT** role and selecting the business client they represent.

The flow is:

Business Client
→ Client Contact
→ CLIENT Invitation
→ Invitation Accepted
→ Client-Scoped Membership

After acceptance, the user signs in with their AGENCIE account and accesses the workspace according to their CLIENT permissions.

## Invite During Client Creation

When creating a new business client, AGENCIE can also invite the primary contact.

If **Invite primary contact to the client portal** is enabled, AGENCIE creates a CLIENT invitation associated with the newly created business client.

This avoids creating the client first and then manually inviting the same person from Team.

If the primary contact does not need workspace access yet, disable the invitation option during client creation.

## Client Scope

A CLIENT-only membership is associated with a specific business client.

For example:

Agency
├── Client A
│   └── CLIENT User A
│
└── Client B
    └── CLIENT User B

CLIENT User A should only receive supported access related to Client A.

They should not gain access to Client B simply because both businesses are managed by the same agency.

## What Client Users Can Access

CLIENT users receive only the workspace areas and resources currently made available to their client-facing role.

Their experience can therefore be different from the workspace used by internal agency employees.

Access is determined by:

- Agency membership
- CLIENT role
- Associated business client
- Resource permissions
- Current product capabilities

Not every internal agency feature is exposed to CLIENT users.

## What Client Users Do Not Get

A CLIENT-only user does not receive general internal agency access simply by joining the workspace.

They should not receive unrestricted access to:

- Other business clients
- Internal Team management
- Agency administration
- Internal role management
- Other clients' campaigns or operational data
- Management controls outside their permitted scope

The exact actions available depend on the current CLIENT permissions.

## Direct URLs Do Not Bypass Client Scope

Client restrictions are not based only on hidden navigation.

If a CLIENT user attempts to directly open a protected resource belonging to another business client, AGENCIE still checks their membership and client association.

Knowing another campaign, workflow, or resource URL does not grant access to it.

> [!IMPORTANT] Client Isolation
> A CLIENT user's access is scoped to the business client associated with their membership. Client-facing navigation is only one part of that protection; protected resources are also checked by the backend.

## CLIENT With Internal Roles

CLIENT can also exist alongside legitimate internal agency roles where required.

For example:

Editor + CLIENT

A member with an internal agency role is not automatically reduced to CLIENT-only access simply because a client association exists on their membership.

Internal roles continue to provide their permitted agency capabilities.

This is different from a CLIENT-only external user, whose access remains client-scoped.

## Changing Client Association

When adding the CLIENT role to an existing agency member, the business client they represent must also be selected.

Because the person already has a membership:

- Their existing membership is updated.
- The selected business client is associated with it.
- A second membership is not required.
- A new invitation is not required simply to change their existing roles.

If the CLIENT role is later removed and the client association is no longer required, the association can be cleared as part of the membership update.

## Client Access Is Not Team Access

External CLIENT users should not be treated as ordinary internal employees.

Internal Team access and client-facing access serve different purposes.

**Internal roles**
→ Operate the agency

**CLIENT role**
→ Access supported information related to the business the user represents

This separation helps prevent internal agency operations from being exposed simply because a client needs visibility into their own work.

## If A Client Cannot Access Their Workspace

Check:

1. The invitation was sent to the correct email.
2. The invitation was accepted.
3. The user signed in using the invited email.
4. Their agency membership is active.
5. The CLIENT role is assigned.
6. The correct business client is associated with the membership.
7. The resource they are trying to access belongs to that business client.

If those are correct but a supported client resource remains inaccessible, investigate the resource permission rather than widening the user's role unnecessarily.

> [!TIP] Give Clients Only The Access They Need
> CLIENT access exists to let external users participate in supported client-facing parts of AGENCIE without exposing the agency's broader internal operations. Do not assign an internal role merely to work around a client-access problem.