---
title: Contacts
description: Track the people associated with a business client.
category: Clients
order: 4
roles:
  - OWNER
  - ADMIN
  - MANAGER
status: PARTIAL
---

## What It Is

Client Contacts stores the people associated with a business client, such as the primary contact, marketing lead, business owner, or other stakeholders.

A business client can have multiple contacts, while one contact can be designated as the primary contact.

## Primary Contact

When creating a new business client, the primary contact name and email are required.

The primary contact becomes the main person associated with that client during onboarding.

If **Invite primary contact to the client portal** is enabled, AGENCIE also creates a CLIENT invitation linked to the newly created business client.

This connects client onboarding with client portal access without requiring a separate Team invitation.

## What Is Available

The backend supports multiple client contacts.

Contacts can be:

- Created
- Listed
- Updated
- Archived
- Marked as primary
- Associated with a user profile where supported

Contact information can include email, phone, and WhatsApp details.

Sensitive contact fields are protected by the application's existing data-security mechanisms.

## Client Contacts vs CLIENT Users

A **Client Contact** and a **CLIENT user** are related concepts, but they are not the same thing.

Client Contact
→ A person associated with the business client

CLIENT user
→ An AGENCIE user account with authenticated access scoped to that business client

A contact does not automatically need an AGENCIE account.

When a primary contact is invited to the client portal and accepts the invitation, their CLIENT membership is linked to the corresponding business client.

## Current Limitation

The complete client contacts management experience is still being developed.

Some client-facing management screens may continue to use the primary contact information directly rather than exposing every contact-management capability available in the backend.

> [!IMPORTANT] Privacy
> Client contact details may contain sensitive personal information.

Contact information should only be visible to users whose role and permissions allow access to that client. CLIENT access must remain scoped to the business client associated with the user's membership.