# Project Status: ClientContact & Client Portal Design — August 4, 2026

## Overview

This session implemented the **`ClientContact`** domain as a standalone, multi-contact capability per client organization. It separates client-side people from internal agency `Membership` while supporting field-level encryption, primary contact uniqueness, optional universal `User` linkage for client portal preparation, outbox domain events, and REST API endpoints.

---

## 1. Database Schema (`Prisma`)

Added the following model and enums in [schema.prisma](file:///Users/suryateja/Documents/agos%202/backend/prisma/schema.prisma):

```prisma
model ClientContact {
  id                     String              @id @default(uuid())
  agencyId               String
  clientId               String
  userId                 String?
  name                   String
  designation            String?
  emailEncrypted         String?
  emailHash              String?
  phoneEncrypted         String?
  phoneHash              String?
  whatsappEncrypted      String?
  whatsappHash           String?
  role                   ClientContactRole   @default(PRIMARY)
  isPrimary              Boolean             @default(false)
  preferredContactMethod ContactMethod?
  status                 ClientContactStatus @default(ACTIVE)
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt
  deletedAt              DateTime?
  version                Int                 @default(1)
  agency                 Agency              @relation(fields: [agencyId], references: [id])
  client                 Client              @relation(fields: [clientId], references: [id], onDelete: Cascade)
  user                   User?               @relation(fields: [userId], references: [id])

  @@index([agencyId, clientId])
  @@index([agencyId, emailHash])
  @@index([userId])
  @@map("client_contacts")
}

enum ClientContactRole {
  PRIMARY
  BILLING
  TECHNICAL
  CREATIVE_APPROVER
  EXECUTIVE
  OTHER
}

enum ClientContactStatus {
  ACTIVE
  INACTIVE
}

enum ContactMethod {
  EMAIL
  PHONE
  WHATSAPP
}
```

---

## 2. Security & Encryption Architecture

- **At-Rest Encryption**: Sensitive contact channels (`email`, `phone`, `whatsapp`) are encrypted using `CryptoService` (`AES-256-GCM`).
- **HMAC Lookup Hashes**: `emailHash`, `phoneHash`, and `whatsappHash` are stored alongside encrypted fields to allow fast indexed lookups without exposing plain-text values in query logs.
- **Role & Scope Isolation**: `ClientContact` records remain scoped to `agencyId` and `clientId`. Viewing or mutating contacts requires active membership in the target agency.

---

## 3. Domain Outbox Events

Added events to [domain-event.ts](file:///Users/suryateja/Documents/agos%202/backend/packages/events/domain-event.ts):

- `ClientContactCreated`: Fired when a contact is added.
- `ClientContactUpdated`: Fired when contact details or primary flags change.
- `ClientContactArchived`: Fired when a contact is soft-deleted.
- `ClientContactLinkedToUser`: Fired when a universal `User` profile is linked.

---

## 4. API Endpoint Specification

Exposed on [client.controller.ts](file:///Users/suryateja/Documents/agos%202/backend/modules/client/client.controller.ts):

- `POST /api/v1/clients/:clientId/contacts`: Creates a new contact with optional encryption parameters.
- `GET /api/v1/clients/:clientId/contacts`: Retrieves contacts for a client with decrypted contact channels.
- `PATCH /api/v1/clients/:clientId/contacts/:contactId`: Updates contact properties and manages primary toggling.
- `POST /api/v1/clients/:clientId/contacts/:contactId/archive`: Soft-deletes a contact (`status: INACTIVE`).
- `POST /api/v1/clients/:clientId/contacts/:contactId/link-user`: Links a universal `User` profile to the contact.

---

## 5. Verification & Test Summary

- **Prisma Validation**: Executed `npx prisma validate` & `npm run prisma:generate` (Success).
- **Jest Unit Tests**: 15 passed, 15 total (59 passing tests, including [client-contact.service.spec.ts](file:///Users/suryateja/Documents/agos%202/backend/modules/client/client-contact.service.spec.ts)).
- **Build Checks**: Both backend NestJS and frontend Next.js builds compiled with 0 errors.
