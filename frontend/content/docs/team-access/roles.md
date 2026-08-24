---
title: Multiple roles
description: Give one person more than one responsibility inside an agency.
category: Team & Access
order: 3
roles:
  - OWNER
  - ADMIN
  - MANAGER
status: AVAILABLE
---

## When To Use It

Use multiple roles when one person performs more than one function inside the agency.

Examples:

- Writer + Editor
- DOP + Editor
- Designer + Social Media Manager
- Manager + Writer
- Editor + CLIENT

This is useful for smaller teams where responsibilities naturally overlap.

## How It Works

A team member can have one or more roles within the same agency membership.

AGENCIE uses those roles to determine the workspace areas and actions available to that person.

For example:

Writer
→ Writing-related access

Editor
→ Editing-related access

Writer + Editor
→ Access available through both internal roles

The person's navigation adapts to the roles assigned to them.

## Roles Do Not Assign Work

Having a role means a person is allowed to perform that kind of work.

It does not automatically make them responsible for every matching task in the agency.

For example, a Writer + Editor does not automatically receive every writing and editing task.

Actual responsibility still depends on things such as:

- Campaign assignment
- Workflow task ownership
- Gig assignment
- Reviewer assignment

Role
→ What you can do

Assignment
→ What you are responsible for

## Changing Roles

Authorized users can change the roles of an existing team member from **Team**.

Because the person is already an agency member, changing their roles does not send another invitation.

Their workspace access updates according to the new role combination.

## Removing A Role

Removing one role does not remove the member from the agency.

For example:

Writer + Editor
→ Remove Writer
→ Editor

The member remains active but keeps only the access provided by their remaining roles.

Removing the member entirely is a separate Team management action.

Some role changes can be restricted by other responsibilities.

In particular, CLIENT cannot be removed when the user is still the Primary Contact for one or more business clients.

## CLIENT With Internal Roles

CLIENT is different from normal internal agency roles because it provides access to specific business clients.

A person can have CLIENT together with legitimate internal agency roles.

For example:

Editor + CLIENT

or:

Manager + CLIENT

Their internal role access is preserved.

CLIENT does not globally reduce an internal team member to client-only access.

For example:

Editor + CLIENT
→ Internal Editor capabilities
→ CLIENT access to assigned business clients

A CLIENT-only external user, however, receives only the supported client-facing capabilities available through CLIENT.

## CLIENT Role vs Client Access

The CLIENT role and client access are related but separate concepts.

**CLIENT role**
→ Enables client-facing capabilities

**Client access**
→ Determines which business clients the user can access

A CLIENT user can have access to more than one business client.

For example:

Maya
→ CLIENT
→ Client A
→ Client B

Arun
→ CLIENT
→ Client B

Maya can access supported resources for Client A and Client B.

Arun can access supported resources for Client B only.

Assigning the CLIENT role therefore requires selecting the business client or clients the person should be able to access.

## Assigning The CLIENT Role

When adding CLIENT to an existing member, select one or more business clients they should be able to access.

Because the person already belongs to the agency:

- Their existing membership is updated.
- Client access is granted to the selected business clients.
- No second membership is created.
- No new invitation is created.
- No invitation email is sent simply because their roles changed.

Adding CLIENT access does not automatically make the person Primary Contact for those clients.

Primary Contact is managed separately.

## Primary Contact

A CLIENT user can also be designated as the **Primary Contact** for a business client they have access to.

For example:

Client A
├── Maya — CLIENT + Primary Contact
├── Arun — CLIENT
└── Priya — CLIENT

All three users can have supported access to Client A.

Maya is additionally responsible for receiving supported automated client-facing communication because she is the Primary Contact.

Primary Contact is not another role.

It does not give Maya additional internal agency permissions or broader client access.

It identifies the main communication recipient for that particular business client.

## Primary Contact Across Multiple Clients

A CLIENT user can have access to multiple clients, and Primary Contact status is evaluated separately for each client.

For example:

Maya
├── Client A — Primary Contact
├── Client B — CLIENT access
└── Client C — Primary Contact

Maya is Primary Contact for Client A and Client C.

She has CLIENT access to Client B but is not its Primary Contact.

This distinction is important when changing the user's roles or client access.

## Removing Client Access

Client access can normally be added or removed without changing the person's other roles.

For example:

Maya
→ CLIENT access: Client A, Client B

After update:

Maya
→ CLIENT access: Client A

However, AGENCIE does not allow client access to be removed when the user is currently that client's Primary Contact.

For example:

Maya
→ Client A — Primary Contact
→ Client B — CLIENT access

Removing Client B access:
→ Allowed

Removing Client A access:
→ Blocked

To remove Client A access:

1. Assign another eligible CLIENT user as Client A's Primary Contact.
2. Confirm Maya is no longer Primary Contact.
3. Remove Maya's Client A access.

Changing the Primary Contact does not automatically remove Maya's CLIENT access.

## Removing The CLIENT Role

Removing CLIENT removes the person's client-facing role and associated client access.

Before allowing this change, AGENCIE checks whether the user is Primary Contact for any business client.

If they are Primary Contact, removing CLIENT is blocked.

For example:

Maya
→ Editor + CLIENT
→ Primary Contact for Client A

Attempt:

Editor + CLIENT
→ Editor

Result:

Blocked until Client A receives another Primary Contact.

The correct flow is:

Assign another Primary Contact for Client A
→ Remove CLIENT from Maya
→ Maya remains Editor

This protects the client from losing its designated communication recipient.

> [!IMPORTANT] Primary Contact Protection
> CLIENT role or client access cannot be removed when doing so would remove access required by an active Primary Contact relationship. Assign another eligible CLIENT user as Primary Contact first.

## Changing Primary Contact Does Not Change Roles

Primary Contact assignment should not be used as a shortcut for changing someone's roles or portal access.

For example:

Before:

Client A
├── Maya — CLIENT + Primary Contact
└── Arun — CLIENT

Change Primary Contact to Arun.

After:

Client A
├── Maya — CLIENT
└── Arun — CLIENT + Primary Contact

Maya keeps her CLIENT access unless an authorized user separately removes it.

This allows agencies to change communication ownership without unexpectedly removing someone's portal access.

> [!TIP] Model Responsibilities Separately
> Use roles for capabilities, assignments for specific work, client access for business-client visibility, and Primary Contact for client communication ownership. Keeping those concepts separate makes access changes predictable.