# 2026-07-31 Client Playbook and Page Filters

## Goal

Treat the client record as agency operational memory, not a basic CRM contact.

## Backend

- Expanded `Client` with optional V1 playbook fields for:
  - general information
  - primary contact
  - brand context
  - target audience
  - social presence
  - content strategy
  - approval operations
  - billing/engagement metadata
  - AI context
  - internal agency notes
- Existing minimal fields still work.
- Blank optional text fields are normalized to `null`.
- Local database schema was synced with Prisma.

## Frontend

- Client creation is now a multi-section playbook form:
  - General
  - Primary Contact
  - Brand
  - Audience
  - Social Presence
  - Content Strategy & Approvals
  - AI Context & Internal Notes
- Industry is now a predefined dropdown with an `Other` path for custom industries.
- Added shared client option constants for industry and operational dropdowns.

## Filters

- Clients page:
  - search
  - industry
  - status
- Campaigns page:
  - search
  - client
  - status
- Content page:
  - search
  - client
  - campaign
  - type
  - status
- Team page:
  - search
  - role
  - status
- Workflow page already has board filters:
  - search
  - client
  - campaign
  - owner
  - risk

## Product Boundary

- Filtering is client-side for this slice because current list sizes are small.
- Server-side filtering, pagination, and saved views can come later when usage proves the need.
- Assets, file uploads, billing, contracts, and social API connections remain V2.
