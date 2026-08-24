---
title: Client access
description: Understand how external client users access AGENCIE, how client access is scoped, and how Primary Contacts work.
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

A CLIENT user can be given access to one or more business clients managed by the agency.

Their client-facing access is scoped to the business clients explicitly assigned to them rather than the agency's complete client portfolio.

## Business Client, CLIENT User, and Primary Contact

These are separate concepts in AGENCIE.

**Business Client**
→ The company or brand your agency works with

**Client Contact**
→ A person associated with that business

**CLIENT User**
→ A person with an AGENCIE account who has been given CLIENT access to one or more business clients

**Primary Contact**
→ The CLIENT user designated as the main communication recipient for a specific business client

A business client can have multiple CLIENT users with portal access.

However, one of those users can be designated as the **Primary Contact** for that client.

CLIENT access determines which client resources a user can access.

Primary Contact determines who receives automated client-facing communication.

These responsibilities are intentionally separate.

## Multiple Client Users

A business client can have multiple CLIENT users.

For example:

Agency
└── Client A
    ├── CLIENT User A — Primary Contact
    ├── CLIENT User B
    └── CLIENT User C

All three users can have supported portal access to Client A.

Only CLIENT User A is the Primary Contact.

Assigning CLIENT access does not automatically make a user the Primary Contact.

This allows agencies to give multiple people access to reports and other supported client-facing resources without sending every automated notification to everyone.

## Primary Contact

The Primary Contact is the main AGENCIE user associated with client communication for a business client.

The Primary Contact:

- Must have CLIENT access to that business client.
- Remains a normal CLIENT user for access-control purposes.
- Receives automated client-facing email notifications where Primary Contact delivery is supported.
- Can be replaced by another eligible CLIENT user.
- Does not receive additional portal permissions simply because they are Primary Contact.

Primary Contact is therefore a communication responsibility, not a separate role.

For example:

Client A

CLIENT access:
- Maya
- Arun
- Priya

Primary Contact:
- Maya

Maya, Arun, and Priya can all access supported Client A resources.

Automated client-facing notifications are sent to Maya when the relevant feature uses Primary Contact delivery.

## Assigning A Primary Contact

An authorized agency user can designate an eligible CLIENT user as the Primary Contact for a business client.

Primary Contact can be managed through supported client and Team management flows.

When assigning a Primary Contact:

1. The selected person must have CLIENT access to that business client.
2. AGENCIE associates that user with the client's Primary Contact.
3. Future supported client-facing notifications are directed to that user.

If another user was previously Primary Contact, assigning the new Primary Contact replaces that designation.

The previous Primary Contact does not automatically lose CLIENT access.

For example:

Before:

Client A
- Maya — CLIENT + Primary Contact
- Arun — CLIENT

Change Primary Contact to Arun.

After:

Client A
- Maya — CLIENT
- Arun — CLIENT + Primary Contact

Maya can continue accessing Client A unless her CLIENT access is separately removed.

## Primary Contact And Notifications

Primary Contact controls the recipient of supported automated client-facing communication.

For features that use Primary Contact delivery:

**Primary Contact**
→ Receives the client-facing email

**Other CLIENT users**
→ Keep their permitted portal access but do not receive that automated email

For example, when a scheduled report-ready notification runs:

Client A
├── Maya — Primary Contact → Email sent
├── Arun — CLIENT → No email
└── Priya — CLIENT → No email

Arun and Priya can still access the reports if their CLIENT permissions allow it.

This prevents every person with portal access from receiving operational emails intended for the client's main contact.

## Primary Contact Protection

AGENCIE protects the Primary Contact relationship when client access or membership is changed.

If a user is currently the Primary Contact for a client, their CLIENT access to that client cannot be removed until another eligible user is assigned as Primary Contact.

Similarly, removing their CLIENT role or agency membership is blocked when doing so would remove an active Primary Contact relationship.

The required flow is:

Current Primary Contact
→ Assign another eligible CLIENT user as Primary Contact
→ Update or remove the previous user's CLIENT access if required

This prevents a client from unintentionally losing its designated communication recipient.

> [!IMPORTANT] Reassign Primary Contact First
> If AGENCIE blocks removal of CLIENT access, the CLIENT role, or a member because they are a Primary Contact, assign another eligible CLIENT user as Primary Contact first.

## Inviting A Client User

A CLIENT user can be invited by assigning the **CLIENT** role and selecting the business client or clients they should be able to access.

After acceptance, the user signs in with their AGENCIE account and accesses supported client-facing areas according to their CLIENT permissions and assigned client access.

CLIENT access and Primary Contact are separate.

Inviting a user or granting CLIENT access does not automatically make that person the Primary Contact unless the applicable client flow explicitly assigns them as Primary Contact.

## Client Scope

CLIENT access is explicitly associated with business clients.

For example:

Agency
├── Client A
│   ├── CLIENT User A
│   └── CLIENT User B
│
└── Client B
    ├── CLIENT User B
    └── CLIENT User C

In this example:

- User A can access Client A.
- User B can access Client A and Client B.
- User C can access Client B.

Having CLIENT access to one business does not grant access to every client managed by the agency.

## What Client Users Can Access

CLIENT users receive only the workspace areas and resources currently made available to their client-facing role and assigned clients.

Their experience can therefore be different from the workspace used by internal agency employees.

Access is determined by:

- Agency membership
- CLIENT role
- Assigned client access
- Resource permissions
- Current product capabilities

Not every internal agency feature is exposed to CLIENT users.

## What Client Users Do Not Get

A CLIENT-only user does not receive general internal agency access simply by joining the workspace.

They should not receive unrestricted access to:

- Business clients they have not been assigned
- Internal Team management
- Agency administration
- Internal role management
- Other clients' campaigns or operational data
- Management controls outside their permitted scope

The exact actions available depend on the current CLIENT permissions.

## Direct URLs Do Not Bypass Client Scope

Client restrictions are not based only on hidden navigation.

If a CLIENT user attempts to directly open a protected resource belonging to a business client they do not have access to, AGENCIE still checks their membership and client access.

Knowing another campaign, workflow, file, or resource URL does not grant access to it.

> [!IMPORTANT] Client Isolation
> CLIENT access is limited to the business clients explicitly assigned to the user. Client-facing navigation is only one part of that protection; protected resources are also checked by the backend.

## CLIENT With Internal Roles

CLIENT can also exist alongside legitimate internal agency roles where required.

For example:

Editor + CLIENT

A member with an internal agency role is not automatically reduced to CLIENT-only access simply because CLIENT access exists.

Internal roles continue to provide their permitted agency capabilities.

This is different from a CLIENT-only external user, whose client-facing access remains limited to their assigned business clients.

## Changing Client Access

When adding the CLIENT role to an existing agency member, one or more business clients can be selected.

Because the person already has a membership:

- Their existing membership is updated.
- CLIENT access is granted to the selected business clients.
- A second membership is not required.
- A new invitation is not required simply to change their existing roles.

Adding client access does not automatically make the person Primary Contact.

If CLIENT access is later removed for a particular client, AGENCIE checks whether the user is that client's Primary Contact.

If they are Primary Contact, the removal is blocked until another eligible CLIENT user becomes Primary Contact.

## Client Access Is Not Team Access

External CLIENT users should not be treated as ordinary internal employees.

Internal Team access and client-facing access serve different purposes.

**Internal roles**
→ Operate the agency

**CLIENT role**
→ Enables supported client-facing capabilities

**Client access**
→ Determines which business clients the CLIENT user can access

**Primary Contact**
→ Determines the main communication recipient for a business client

Keeping these concepts separate prevents client portal access from accidentally exposing internal agency operations or sending client communication to every portal user.

## If A Client Cannot Access Their Workspace

Check:

1. The invitation was sent to the correct email.
2. The invitation was accepted.
3. The user signed in using the invited email.
4. Their agency membership is active.
5. The CLIENT role is assigned.
6. The correct business client is included in their client access.
7. The resource they are trying to access belongs to one of their assigned clients.

If the problem is specifically related to automated client emails, also check:

8. The correct user is assigned as the client's Primary Contact.
9. The Primary Contact still has CLIENT access to that business client.

If those are correct but a supported client resource remains inaccessible, investigate the resource permission rather than widening the user's role unnecessarily.

> [!TIP] Access And Communication Are Separate
> Give CLIENT access to everyone who legitimately needs client-facing workspace access. Designate the Primary Contact separately for the person who should receive the client's automated communication.