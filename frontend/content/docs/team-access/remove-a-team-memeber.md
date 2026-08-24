---
title: Remove a team member
description: Remove someone's access to an agency workspace and understand Primary Contact restrictions.
category: Team & Access
order: 6
roles:
  - OWNER
status: AVAILABLE
---

## What It Does

Removing a team member removes their active membership from the current agency.

They will no longer have access to that agency workspace through the removed membership.

This is different from changing someone's roles.

**Edit Roles**
→ Changes what an existing member can do

**Remove Member**
→ Removes their membership from the agency

## Who Can Remove Members

In the current Team access model, removing members is an **Owner-only** action.

Other roles may have Team management capabilities without being allowed to remove agency members.

## How To Remove A Member

1. Open **Team**.
2. Find the member you want to remove.
3. Choose **Remove**.
4. Review the confirmation.
5. Confirm the removal.

AGENCIE checks whether the member can safely be removed before completing the operation.

If the member is a Primary Contact for a business client, removal is blocked until another eligible CLIENT user is assigned as Primary Contact.

After successful removal, the person should no longer appear as an active member of the agency.

## Before Removing Someone

Check whether the member currently owns active work or important client responsibilities.

This can include:

- Workflow tasks
- Gigs
- Campaign responsibilities
- Review responsibilities
- CLIENT access
- Primary Contact responsibilities
- Other assigned work

Where necessary, reassign important work before removing the member.

Removing someone's workspace access does not mean their unfinished responsibilities have magically found a new human.

## Primary Contact Protection

A member cannot be removed from the agency while they are the **Primary Contact** for one or more business clients.

For example:

Client A
→ Primary Contact: Maya

Client B
→ Primary Contact: Maya

Attempting to remove Maya from the agency is blocked because both clients currently depend on her as their Primary Contact.

Before removing Maya:

1. Assign another eligible CLIENT user as Primary Contact for Client A.
2. Assign another eligible CLIENT user as Primary Contact for Client B.
3. Confirm Maya is no longer Primary Contact for any client.
4. Remove Maya from the agency.

This protection prevents removing the user responsible for receiving automated client-facing communication while the client still references them as its Primary Contact.

> [!IMPORTANT] Primary Contact Must Be Reassigned
> AGENCIE blocks member removal when the member is Primary Contact for one or more clients. Assign another eligible CLIENT user as Primary Contact for every affected client before removing the member.

## Removing CLIENT Access

CLIENT access and agency membership are separate concerns.

If the member should remain part of the agency but no longer needs access to a particular business client, edit their roles and client access instead of removing the entire membership.

However, CLIENT access to a client cannot be removed while that user is the client's Primary Contact.

For example:

Maya
→ CLIENT access: Client A, Client B
→ Primary Contact: Client A

You can remove Maya's access to Client B without changing the Primary Contact for Client A.

You cannot remove Maya's access to Client A until another eligible CLIENT user becomes Client A's Primary Contact.

The required sequence is:

Assign new Primary Contact
→ Remove old Primary Contact designation
→ Remove previous user's client access if required

Changing the Primary Contact does not automatically remove the previous user's CLIENT access.

## Removing The CLIENT Role

The CLIENT role can also be removed while keeping other internal roles where appropriate.

For example:

Editor + CLIENT
→ Remove CLIENT
→ Editor

Before removing CLIENT, AGENCIE checks whether the user is currently Primary Contact for any client.

If they are, the role change is blocked until those Primary Contact responsibilities are reassigned.

This prevents removing the access required by an active Primary Contact relationship.

## Removing vs Changing Roles

Do not remove someone simply because their responsibilities changed.

For example:

Writer + Editor
→ Now only Editor

Use **Edit Roles** and remove the Writer role.

The person's agency membership remains active and their access updates according to the remaining role.

Similarly:

Editor + CLIENT
→ No longer needs client portal access
→ Keep Editor and remove CLIENT

Use **Remove Member** only when the person should no longer belong to the agency.

## What Happens To Existing Work

Removing a member affects their agency access.

Historical records connected to that person may remain so the agency can preserve operational history and traceability.

Before removal, check active assignments and transfer work where necessary.

Do not assume removing the membership automatically reassigns every task or Gig they owned.

## Previous Invitations

A member may have originally joined through an invitation.

Removing the member does not need to erase the historical invitation that was previously accepted.

An old invitation can therefore remain **Accepted** even though the person's current agency membership has been removed.

Invitation history and active membership are separate records.

## Re-Inviting A Removed Member

If the person needs to join the agency again later, send a new invitation.

The flow becomes:

Previous Membership
→ Removed

New Invitation
→ Pending
→ Accepted
→ New or Reactivated Membership

The new invitation should have its own status and lifecycle.

A previously accepted invitation does not automatically make a new invitation accepted.

## CLIENT Members

A CLIENT member can have access to one or more business clients.

Removing their agency membership removes the client access provided through that membership.

Before removal, AGENCIE checks whether the member is Primary Contact for any of those clients.

If they are, removal is blocked until another eligible CLIENT user is assigned as Primary Contact for each affected client.

If you only need to change their client access or roles, edit the existing membership instead of removing the person entirely.

## Multiple Agencies

Removing someone from one agency does not remove their AGENCIE account.

It also does not remove memberships they may have in other agencies.

For example:

Agency A
→ Membership removed

Agency B
→ Membership remains active

Each agency membership is independent.

Primary Contact relationships are also scoped to the relevant agency and business client.

> [!IMPORTANT] Reassign Responsibilities First
> Before removing a member, check whether they own active workflow tasks, Gigs, reviews, or Primary Contact responsibilities. Primary Contact responsibilities must be reassigned before AGENCIE allows the member to be removed.

> [!TIP] Remove Access, Not History
> Removing a member should stop their current agency access without pretending they never existed. Historical assignments and activity can remain useful for understanding what happened during previous work.