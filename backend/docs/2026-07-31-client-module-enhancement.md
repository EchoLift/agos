# 2026-07-31 Client Module Enhancement

## Goal

Move the Client module from a basic CRM record toward a complete Client Playbook for agency operations.

## Backend

- `GET /api/v1/clients/:id` now returns a role-aware playbook response:
  - `client`
  - `sections`
  - `canEdit`
  - `visiblePermissions`
- The backend filters client sections before returning data.
- The frontend does not decide which sensitive client fields a role may see.
- Added permission keys for future role control:
  - `CLIENT_PLAYBOOK_VIEW`
  - `CLIENT_INTERNAL_VIEW`
  - `CLIENT_AI_CONTEXT_VIEW`
  - `CLIENT_APPROVAL_VIEW`
- Owners can see all sections.
- Managers/Admins can see operational, approval, AI context, and internal sections.
- Writers, DOPs, Editors, Designers, and Members see production-safe client context.

## Frontend

- Create Client and Edit Client now use the same shared playbook form.
- Client Details renders the backend-provided sections.
- Missing fields display `— Not provided`.
- Edit Client exposes the same editable model as Create Client.
- Large client forms are collapsible by section.

## Dropdowns

Expanded predefined option sets for:

- Industry
- Brand Voice
- Business Size
- Content Goals
- Content Types
- Preferred Contact Method
- Posting Frequency
- Approval SLA
- Revision Limit
- Priority
- Engagement Model
- Billing Cycle

Fields that remain free text are intentionally contextual, such as:

- Brand Story
- Target Audience Description
- Internal Notes
- AI Context
- Special instructions and knowledge fields

## Product Boundary

- This is not a full CRM.
- The client profile is the agency's operational memory for production.
- Billing, contracts, file uploads, and client-facing visibility remain future slices.
