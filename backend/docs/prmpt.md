You are working on AGOS, a multi-tenant operating system for digital marketing agencies.

Your task is to redesign and implement authentication, universal identity resolution, agency membership, workspace switching, role-based authorization, employee/client onboarding, and legacy-data compatibility around a single-login identity model.

The core identity rule is:

One normalized email address maps to one universal user UUID.

That universal user may belong to multiple agencies and may hold one or more agency-scoped roles in each agency.

Example:

surya@example.com

- Agency A: OWNER, EDITOR, WRITER
- Agency B: CLIENT
- Agency C: MANAGER
- Agency D: CLIENT, REVIEWER

Do not begin coding immediately.

First inspect the entire existing repository and understand the current architecture.

Identify:

1. Frontend framework and routing structure
2. Backend framework and API organization
3. Authentication provider and current login/session flow
4. Database technology, schema, ORM, migrations, and constraints
5. Existing user, agency, employee, client, role, invitation, and workspace models
6. Existing global state, context, query cache, or state-management approach
7. Existing dashboard layouts and navigation
8. Existing frontend route guards
9. Existing backend authentication and authorization middleware
10. Existing role and permission logic
11. Existing profile dropdown and workspace switcher
12. Existing agency creation flow
13. Existing employee invitation and onboarding flow
14. Existing client onboarding and client-account model
15. Existing seeded/demo data
16. Existing tests and testing frameworks
17. Existing audit logging, notification, and caching mechanisms
18. Existing legacy records that may require migration

After inspection, provide a concise implementation plan before modifying code.

The plan must list:

- Existing architecture summary
- Files to modify
- Files to create
- Database/schema changes
- Migration approach
- API changes
- Authentication changes
- Authorization changes
- Frontend changes
- Cache and query-state changes
- Employee/client onboarding changes
- Legacy compatibility considerations
- Security considerations
- Testing strategy
- Assumptions and unresolved questions

Do not unnecessarily replace the existing architecture, libraries, styling, authentication provider, state-management approach, ORM, database conventions, API utilities, or component patterns.

Reuse existing systems wherever practical.

Do not rewrite unrelated modules.

# Product requirement

AGOS must use one email identity as the universal login point.

A person may participate in many agencies and may have a different responsibility in each agency.

Example:

surya@example.com may be:

- Client in Agency A
- Writer in Agency B
- Editor in Agency C
- Owner and Manager in Agency D

When this person logs in once with surya@example.com, AGOS must:

1. Resolve the verified email to one universal user identity.
2. Fetch every active agency membership associated with that identity.
3. Display every accessible agency in the workspace switcher.
4. Allow workspace switching without signing out.
5. Load roles and effective permissions for the selected agency.
6. Render navigation, dashboards, queries, actions, and data according to that agency context.
7. Never treat an invited employee or client as a generic new user merely because this is their first login.
8. Never require separate employee and client accounts for the same email.
9. Support multiple roles inside the same agency.
10. Allow employees and clients to be onboarded before they create or access their AGOS account.
11. Preserve memberships in all existing agencies when a user creates another agency.
12. Prevent cross-agency data exposure at both API and database-query levels.

# Core architecture principle

There must be one global identity and separate agency-scoped memberships.

Roles belong to the relationship between a user and an agency.

Roles must not be stored as one global user property.

Incorrect:

user.role = "WRITER"

Correct:

the user has a WRITER role through their membership in Agency B.

The same universal user may simultaneously be:

- CLIENT in Agency A
- WRITER in Agency B
- EDITOR in Agency C
- OWNER and MANAGER in Agency D

# Core domain model

Adapt the following conceptual model to the existing database and naming conventions.

## Universal User

Represents one human identity across AGOS.

Suggested fields:

- id: UUID
- email
- normalizedEmail
- name
- avatarUrl
- phone
- authProviderId or authentication metadata
- status
- lastActiveAgencyId, if appropriate
- createdAt
- updatedAt

Rules:

- normalizedEmail must be unique
- one normalized email maps to exactly one UUID
- email lookup must be case-insensitive
- whitespace must be trimmed
- users must not be duplicated per agency
- global users must not contain an agency-scoped business role
- authentication identity and agency responsibility must remain separate

## Agency

Suggested fields:

- id
- name
- slug
- logoUrl
- status
- createdAt
- updatedAt

Preserve any existing agency ownership metadata only where required, but agency ownership authorization should ultimately be represented through membership roles.

## AgencyMembership

Represents one relationship between a universal user and an agency.

Suggested fields:

- id
- agencyId
- userId, nullable only while the membership is unclaimed
- invitedEmail
- normalizedInvitedEmail
- status
- displayName
- jobTitle or relationship label
- teamId, if already supported
- reportingManagerId, if already supported
- joinedAt
- claimedAt
- createdAt
- updatedAt

Possible statuses:

- PENDING
- ACTIVE
- SUSPENDED
- REMOVED

Rules:

- one active membership per user per agency
- one pending membership per normalized invited email per agency
- a user may belong to multiple agencies
- membership status controls workspace access
- suspended and removed memberships must not grant access
- client and employee access must both be represented through memberships
- legacy employee or client records may remain linked as business records where necessary

## MembershipRole

Represents one role assigned to one agency membership.

Suggested fields:

- membershipId
- role
- createdAt
- assignedBy
- metadata, only if required

Possible roles:

- OWNER
- MANAGER
- ADMIN
- EDITOR
- WRITER
- DESIGNER
- SOCIAL_MEDIA_MANAGER
- FINANCE
- CLIENT
- REVIEWER
- VIEWER

Use the existing role names where already defined.

Do not create duplicate role systems unless migration requires a temporary compatibility layer.

Add a unique constraint for:

membershipId + role

## Client organization or client account

Do not treat a client person and client business as the same entity.

Preserve this distinction:

Universal User
    ↓
Agency Membership with CLIENT role
    ↓
Client Contact relationship
    ↓
Client Organization or Account
    ↓
Projects, campaigns, deliverables, billing, approvals

One client organization may have multiple client contacts.

The same person may be a client in one agency and an employee or owner in another.

# Derived agencies read model

The frontend may consume a convenient agencies summary such as:

{
  "userId": "universal-user-uuid",
  "email": "surya@example.com",
  "agencies": {
    "agency-a": ["OWNER", "EDITOR", "WRITER"],
    "agency-b": ["CLIENT"],
    "agency-c": ["MANAGER"],
    "agency-d": ["CLIENT", "REVIEWER"]
  }
}

However:

- the agencies object must not be the authoritative source of truth
- membership and membership-role records remain authoritative
- the agencies object must be generated from authoritative records
- it may be returned as an API read model or stored as a rebuildable cache
- authorization must never trust a stale denormalized agencies object
- no business operation should depend on manually synchronizing a JSON blob with membership tables

# Email normalization

Create or reuse one shared email-normalization utility.

It must:

- trim surrounding whitespace
- convert to lowercase
- validate the email format
- reject empty or invalid values
- produce the same normalized result across authentication, invitations, onboarding, lookup, migration, and duplicate prevention

These must resolve to the same identity:

Surya@Example.com
surya@example.com
 SURYA@example.com

Do not apply provider-specific transformations such as:

- removing Gmail dots
- stripping plus aliases
- rewriting domains

unless AGOS already intentionally supports and documents that behavior.

Use normalized email consistently for:

- authenticated user lookup
- account creation
- invitation lookup
- employee onboarding
- client onboarding
- membership claiming
- duplicate detection
- migration
- legacy-data matching

# Authentication and identity resolution

After authentication succeeds:

1. Obtain the verified email from the authentication provider.
2. Reject the login or restrict claiming if the provider cannot verify the email and verification is required.
3. Normalize the email.
4. Find the universal user by normalized email.
5. Create the universal user only if no matching identity exists.
6. Search for unclaimed memberships where normalizedInvitedEmail matches.
7. Search any legacy invitation, employee, client-contact, or membership records that still require compatibility lookup.
8. Safely attach matching memberships to the universal user.
9. Mark valid memberships as claimed and ACTIVE where appropriate.
10. Preserve membership status when a record is suspended, removed, expired, or otherwise not claimable.
11. Load all active memberships.
12. Load all roles for each membership.
13. Calculate effective permissions.
14. Build the workspace list.
15. Resolve the initial active workspace.
16. Return the universal identity, active workspace, memberships, roles, permissions, and agencies summary to the frontend.
17. Record relevant audit events.

The user must not be sent to generic new-user onboarding if their email already exists in:

- an active membership
- a pending employee membership
- a pending client membership
- an accepted invitation
- a legacy invitation
- an employee record
- a client-contact record
- a legacy client record
- any compatible pre-auth onboarding record

# First-login behavior

## Case A: Existing invited employee

The user's normalized email already exists in an employee invitation or pending employee membership.

Expected behavior:

- resolve or create the universal user
- claim the membership
- attach the correct employee roles
- activate the membership where valid
- open the agency workspace
- render employee navigation and dashboard according to effective permissions
- do not ask the user to create an agency
- do not create a duplicate employee identity

## Case B: Existing client contact

The user's normalized email already exists as a client contact, pending client membership, or client invitation.

Expected behavior:

- resolve or create the universal user
- claim or attach the membership
- assign CLIENT role
- preserve the separate client organization/account relationship
- open the correct agency workspace
- render client-specific approvals, deliverables, invoices, analytics, comments, and communication according to the existing feature set
- do not expose internal employee information
- do not ask the client to create an agency

## Case C: User belongs to multiple agencies

Expected behavior:

- return all active memberships
- show one workspace entry per agency
- show role labels beneath each agency
- persist the selected workspace
- allow switching without signing out
- update navigation, dashboard, permissions, and cached data when switching

## Case D: User has multiple roles in one agency

Expected behavior:

- show only one workspace entry for that agency
- combine permissions from all active roles
- display a concise role label such as "Owner, Manager"
- avoid duplicate agency entries
- define a deterministic role-label order
- define a deterministic default-dashboard priority

## Case E: Completely new user

The email has no matching memberships, invitations, employee records, client contacts, or legacy relationships.

Expected behavior:

- show the existing new-user onboarding flow
- allow the user to create an agency
- do not create an empty agency automatically
- do not silently assign roles

## Case F: Suspended, removed, or inactive membership

Expected behavior:

- do not grant workspace access
- exclude inaccessible memberships from normal active workspace lists
- keep the global user account valid
- display an appropriate message if no active workspaces remain
- prevent access through cached frontend state, old URLs, notifications, or manually supplied agency IDs

## Case G: Duplicate or ambiguous legacy records

Expected behavior:

- prevent duplicate workspace entries
- merge exact duplicates safely where possible
- preserve meaningful relationships
- generate migration or audit warnings
- flag ambiguous records for manual review
- never silently delete business data

# Active workspace

Create or adapt a reliable active workspace model.

The active workspace state should include:

- agencyId
- agency name
- agency slug
- agency logo
- membershipId
- membership status
- roles
- effective permissions
- default route
- optional client-account context where relevant

The active workspace must never be selected or authorized solely from a client-provided agencyId.

The backend must verify that:

- the user is authenticated
- the membership belongs to the authenticated universal user
- the membership belongs to the requested agency
- the membership is ACTIVE
- required permissions are present

Persist the last selected agency using the safest existing mechanism, such as:

- a server-side user preference
- a secure session value
- a secure cookie
- local storage only as a non-authoritative UI preference

On login:

1. Attempt to restore the last selected agency.
2. Verify that its membership is still active.
3. Otherwise select a deterministic fallback workspace.
4. Prefer OWNER or MANAGER only if that behavior is appropriate for the existing product.
5. Otherwise use a documented deterministic membership order.
6. Never restore a suspended or removed workspace.

# Current-user and workspace API

Create or adapt an endpoint such as:

GET /api/me

or:

GET /api/me/workspaces

Suggested response:

{
  "user": {
    "id": "user_123",
    "name": "Surya",
    "email": "surya@example.com",
    "avatarUrl": null
  },
  "activeWorkspace": {
    "agencyId": "agency_d",
    "agencyName": "Agency D",
    "agencySlug": "agency-d",
    "logoUrl": null,
    "membershipId": "membership_4",
    "roles": ["OWNER", "MANAGER"],
    "permissions": [
      "agency.manage",
      "members.manage",
      "clients.manage",
      "content.manage",
      "analytics.read"
    ],
    "status": "ACTIVE",
    "defaultRoute": "/dashboard"
  },
  "workspaces": [
    {
      "agencyId": "agency_a",
      "agencyName": "Agency A",
      "agencySlug": "agency-a",
      "logoUrl": null,
      "membershipId": "membership_1",
      "roles": ["CLIENT"],
      "status": "ACTIVE"
    },
    {
      "agencyId": "agency_b",
      "agencyName": "Agency B",
      "agencySlug": "agency-b",
      "logoUrl": null,
      "membershipId": "membership_2",
      "roles": ["WRITER"],
      "status": "ACTIVE"
    },
    {
      "agencyId": "agency_c",
      "agencyName": "Agency C",
      "agencySlug": "agency-c",
      "logoUrl": null,
      "membershipId": "membership_3",
      "roles": ["EDITOR"],
      "status": "ACTIVE"
    },
    {
      "agencyId": "agency_d",
      "agencyName": "Agency D",
      "agencySlug": "agency-d",
      "logoUrl": null,
      "membershipId": "membership_4",
      "roles": ["OWNER", "MANAGER"],
      "status": "ACTIVE"
    }
  ],
  "agencies": {
    "agency_a": ["CLIENT"],
    "agency_b": ["WRITER"],
    "agency_c": ["EDITOR"],
    "agency_d": ["OWNER", "MANAGER"]
  }
}

Adapt all names to the existing API conventions.

The workspaces array is the preferred detailed representation.

The agencies object is an optional convenience read model.

# Workspace switching API

Create or adapt an action such as:

POST /api/workspaces/select

Request:

{
  "agencyId": "agency-b"
}

The server must:

1. Authenticate the global user.
2. Validate the requested agency ID.
3. Find the user's active membership in that agency.
4. Reject inaccessible, suspended, removed, or missing memberships.
5. Load roles from authoritative records.
6. Calculate effective permissions server-side.
7. Persist the selected workspace where appropriate.
8. record a workspace-selected audit event where appropriate.
9. Return the updated active workspace context.

Never accept the following as authoritative frontend input:

- roles
- permissions
- membership status
- client status
- owner status
- agency ownership claims

# Workspace switcher UI

Update the existing AGOS profile dropdown and workspace-switching interface.

The current identity section should display:

- avatar
- user name
- email
- current agency
- current role or roles

The workspace section should display:

- section label: "Switch workspace"
- one item per active agency membership
- agency logo or initial
- agency name
- role label
- active indicator
- loading state during selection
- error state with retry

Example:

Agency A
Client
Active

Agency B
Writer

Agency C
Editor

Agency D
Owner, Manager

Actions should include, where permitted:

- Create another agency
- Agency settings
- My profile
- Status
- Appearance
- Notifications
- Help and support
- Logout

Requirements:

- no duplicate agency entries
- multiple roles displayed on one agency item
- keyboard accessibility
- semantic HTML
- appropriate ARIA attributes
- Escape closes the menu
- long agency names truncate gracefully
- role labels do not overflow
- mobile and desktop support
- menu closes after successful switching
- do not full-page reload unless the existing architecture requires it
- do not flash unauthorized navigation items
- do not briefly show data from the previous agency

On workspace selection:

1. show loading state
2. cancel or guard in-flight requests from the previous agency
3. call the server selection endpoint
4. update global workspace context
5. clear or invalidate agency-scoped cached data
6. update authorization state
7. refetch data for the selected agency
8. resolve the correct default route
9. render the correct navigation and dashboard
10. close the workspace menu

# Role and permission model

Authorization must be permission-based rather than implemented through scattered role comparisons.

Avoid repeatedly writing:

if (role === "WRITER") {
  ...
}

Prefer centralized checks such as:

hasPermission("content.create")

Create or reuse:

- a central permission definition
- role-to-permission mapping
- effective-permission resolver
- backend permission middleware
- frontend permission helper or hook
- route-level authorization guards

Possible permissions include:

- agency.read
- agency.manage
- agency.settings.read
- agency.settings.write
- members.read
- members.manage
- clients.read
- clients.manage
- projects.read
- projects.manage
- tasks.read
- tasks.create
- tasks.update
- tasks.manage
- content.read
- content.create
- content.edit
- content.review
- content.approve
- content.publish
- invoices.read
- invoices.manage
- analytics.read
- internalComments.read
- internalComments.create
- clientComments.read
- clientComments.create
- auditLogs.read

Map permissions according to the actual AGOS feature set.

Conceptual mappings:

OWNER:
- all agency permissions

MANAGER:
- agency operations
- members
- clients
- projects
- tasks
- content
- analytics
- selected settings

WRITER:
- assigned tasks
- briefs
- scripts
- drafts
- comments

EDITOR:
- assigned tasks
- content review
- editing
- internal approval where allowed

CLIENT:
- assigned client projects
- deliverables
- content approval
- client comments
- invoices
- limited analytics

Do not expose the following to client users unless explicitly allowed:

- internal pricing
- employee performance
- internal notes
- internal comments
- other clients
- other client organizations
- agency-wide financial data
- staff-only analytics
- internal audit data

If a membership has multiple roles, effective permissions are the union of permissions from active roles, subject to any explicit deny or custom-scope logic already supported by the project.

# Default dashboard resolver

Create one central resolver for the default route after login or workspace switching.

Possible behavior:

OWNER or MANAGER:
- agency overview dashboard

ADMIN:
- administrative or operational dashboard

WRITER, EDITOR, DESIGNER, SOCIAL_MEDIA_MANAGER:
- assigned work or task dashboard

CLIENT:
- client overview, approval, or deliverables dashboard

If a user has multiple roles:

- choose the first accessible route using a documented role or route priority
- do not spread redirect logic across unrelated components
- never redirect to a route the user lacks permission to access

# Backend route protection

Frontend hiding is not security.

Every agency-scoped backend endpoint must verify:

1. Authenticated universal user
2. Valid agency context
3. Active membership
4. Membership ownership
5. Required permission
6. Resource belongs to the authorized agency

Create or reuse middleware such as:

requireAgencyMembership()
requirePermission("content.approve")
requireAnyPermission([...])
resolveActiveWorkspace()

All agency-scoped database queries must include agencyId.

Incorrect:

findProjectById(projectId)

Correct:

findProject({
  id: projectId,
  agencyId: authorizedAgencyId
})

Apply the same pattern to:

- tasks
- campaigns
- clients
- assets
- deliverables
- comments
- invoices
- notifications
- analytics
- employee records
- content records

This is required to prevent cross-tenant data exposure and IDOR vulnerabilities.

# Employee onboarding

Authorized owners or managers should be able to add an employee using an email even if the person has never logged into AGOS.

Flow:

1. Accept email and selected roles.
2. Normalize the email.
3. Validate that the actor may invite members.
4. Validate that the actor may assign the requested roles.
5. Prevent managers from assigning OWNER unless explicitly allowed.
6. Find the universal user if one already exists.
7. Check for an existing membership in the agency.
8. If an active membership exists:
   - update roles safely
   - do not create a duplicate membership
9. If a pending membership exists:
   - update or merge invitation details safely
10. If the user exists:
   - link the membership immediately
11. If the user does not exist:
   - create an unclaimed membership using normalizedInvitedEmail
12. Assign membership roles.
13. Optionally send an invitation using the existing email mechanism.
14. Record an audit event.
15. On first login, automatically claim the membership.

The invitation email must not be the only source of truth.

If the user loses or ignores the invitation but later signs in using the matching verified email, AGOS must still resolve the membership.

# Client onboarding

Authorized agency users should be able to add a client organization and one or more client contacts.

For each client contact:

1. Accept the contact email.
2. Normalize the email.
3. Resolve the universal user if one exists.
4. Create or reuse the agency membership.
5. Assign CLIENT role.
6. Link the membership or user to the relevant client organization/account.
7. Store normalizedInvitedEmail when the user has not registered.
8. Optionally send an invitation.
9. On first login, claim the membership.
10. Open the correct agency workspace as CLIENT.
11. Restrict data to the linked client organization and permitted resources.

Do not create separate authentication identities for employees and clients.

Do not assume one client organization has only one user.

Do not assume one user can belong to only one client organization unless that restriction is explicitly part of the existing product.

# Role updates

Whenever a role is added, removed, or replaced:

1. Validate actor permission.
2. Validate role-assignment rules.
3. Update MembershipRole records transactionally.
4. Prevent duplicate roles.
5. Recalculate effective permissions.
6. Invalidate membership/session/workspace caches.
7. Refresh active workspace authorization if affected.
8. Record an audit event with previous and new roles.
9. Prevent unauthorized privilege escalation.
10. Prevent the final OWNER from losing ownership without ownership transfer.
11. Ensure removed roles stop granting access immediately or as soon as the existing session model permits safely.

Do not manually update a second JSON source of truth.

# Creating another agency

Preserve or implement the existing "Create another agency" action.

When an existing user creates another agency:

1. Create the agency.
2. Create an ACTIVE membership for the current universal user.
3. Assign OWNER role.
4. Preserve every existing membership in other agencies.
5. Add the agency to the workspace list.
6. switch to the new agency.
7. render the agency-setup or overview route.
8. record relevant audit events.

Do not overwrite roles or active-workspace records for existing agencies incorrectly.

# Global profile versus agency membership profile

Keep universal identity fields separate from agency-specific membership fields.

Global user profile examples:

- name
- email
- avatar
- phone
- authentication settings
- personal preferences
- appearance
- notification preferences

Agency membership profile examples:

- role or roles
- job title
- agency-specific display name
- team
- reporting manager
- client relationship
- membership status
- scoped permissions
- agency-specific metadata

An agency changing an employee label must not overwrite the global user identity unless that is explicitly intended.

# Query and cache behavior

Every agency-scoped frontend query must include the active agency ID or membership ID in its cache key.

Examples:

["projects", activeAgencyId]
["tasks", activeAgencyId, filters]
["clients", activeAgencyId]
["notifications", activeAgencyId]
["analytics", activeAgencyId, dateRange]
["content", activeAgencyId, status]

On workspace switch:

- cancel in-flight requests from the previous agency where possible
- invalidate or clear previous agency-scoped caches
- update workspace context
- update permissions
- fetch new agency data
- prevent stale responses from overwriting the new workspace state
- prevent previous-agency data from appearing temporarily

Global user profile data may remain cached because it is not agency-scoped.

# Derived cache strategy

If performance requires a cached user-to-agencies map, use it only as a derived cache.

Possible shape:

{
  "userId": "uuid",
  "version": 15,
  "agencies": {
    "agency-a": ["OWNER", "EDITOR"],
    "agency-b": ["CLIENT"]
  },
  "generatedAt": "..."
}

Rules:

- membership and role records remain authoritative
- the cache must be rebuildable
- mutations must invalidate or update the cache safely
- correctness must not depend on dual-write success
- stale cache must never grant access
- backend authorization must validate authoritative membership data
- cache versioning may be used to prevent stale session authorization
- never manually synchronize a permanent agencies JSON column as a second source of truth unless explicitly required and protected by database-level mechanisms

# Notifications

Notifications must carry agency context.

Suggested fields:

- id
- userId or membershipId
- agencyId
- agencyName
- eventType
- resourceType
- resourceId
- visibility or required permission
- createdAt
- readAt

A user may receive notifications from several agencies.

The UI may:

- default to notifications for the active workspace
- offer a global notification view grouped by agency

When opening a notification from another agency:

1. verify the user still has active membership
2. verify resource visibility
3. safely switch workspace if needed
4. fetch the resource in the correct agency context
5. reject inaccessible or stale notifications

# Auditability

Record important identity, membership, role, and workspace events.

Examples:

- user created
- employee invited
- client invited
- invitation updated
- membership claimed
- membership activated
- membership suspended
- membership removed
- role assigned
- role removed
- roles replaced
- workspace selected
- client contact linked
- employee linked
- agency created
- ownership transferred

Audit records should include:

- actor user ID
- target user ID, where applicable
- membership ID
- agency ID
- action
- previous value
- new value
- timestamp
- request correlation metadata if already supported

Do not log:

- passwords
- OTPs
- access tokens
- refresh tokens
- authorization headers
- session secrets
- private authentication-provider payloads

# Database constraints

Add appropriate constraints using the existing database and ORM capabilities.

At minimum:

- unique normalized user email
- unique agencyId + userId for claimed memberships
- unique agencyId + normalizedInvitedEmail for pending unclaimed memberships
- unique membershipId + role
- valid membership status
- valid role enum or role foreign key

Handle nullable unique constraints according to the selected database.

Before adding strict constraints:

1. inspect existing duplicates
2. generate a migration report
3. define deterministic merge rules
4. preserve all meaningful relationships
5. flag ambiguous cases
6. avoid silent data deletion
7. make migration repeatable or safely idempotent where practical

Use transactions for identity claiming, membership creation, and role assignment where supported.

# Legacy migration

If the existing system has separate employee and client tables:

1. Normalize all relevant emails.
2. Group records by normalized email.
3. Create or resolve one universal user UUID per unique email where identity can be established.
4. Convert employee-agency relationships into agency memberships.
5. Convert employee roles into membership roles.
6. Convert client contacts into agency memberships with CLIENT role.
7. Preserve client organizations/accounts separately.
8. Preserve client-contact relationships.
9. Convert pending invitations into unclaimed memberships where appropriate.
10. Preserve membership status.
11. Flag duplicate or conflicting records.
12. Keep compatibility reads or mapping tables until migration is verified.
13. Do not delete legacy data immediately.
14. Provide rollback or recovery guidance.

Provide a migration report containing:

- universal users created
- existing users reused
- memberships created
- membership roles created
- client contacts linked
- invitations converted
- duplicate normalized emails found
- ambiguous records
- conflicts requiring manual review
- skipped records and reasons

# Security requirements

Implement all applicable protections:

- require a verified email when supported
- normalize emails consistently
- prevent duplicate identities
- verify server-side agency membership
- resolve roles and permissions server-side
- never trust client-provided roles
- never trust client-provided permissions
- validate every client-provided agency ID
- prevent cross-agency data access
- prevent IDOR vulnerabilities
- filter every agency-owned resource by authorized agency ID
- exclude suspended and removed memberships
- invalidate authorization state after role or membership changes
- prevent stale frontend state from granting access
- protect owner-only actions
- prevent managers from assigning OWNER unless allowed
- prevent final-owner removal without ownership transfer
- avoid revealing hidden workspace memberships through detailed errors
- use safe unauthorized/not-found responses
- ensure invitation claiming only occurs for the matching verified email
- avoid race conditions during user creation and membership claiming
- use transactions and unique constraints to prevent duplicates
- protect client users from internal agency data
- ensure notifications cannot bypass workspace authorization
- ensure cached agencies JSON is not used as sole authorization evidence

# Testing requirements

Use the repository's current testing frameworks.

Add automated tests covering at least:

1. New user with no memberships enters new-user onboarding.
2. Same email with different casing resolves to one universal UUID.
3. Leading and trailing email whitespace does not create duplicates.
4. Invalid email is rejected.
5. Existing invited employee is linked on first login.
6. Existing client contact is linked on first login.
7. Pending membership is claimed only by the matching verified email.
8. One identity loads multiple agencies.
9. One user has multiple roles in one agency.
10. Workspace list contains one entry per agency.
11. User switches from CLIENT in Agency A to WRITER in Agency B.
12. Workspace switch updates effective permissions.
13. Workspace switch clears or invalidates stale agency-scoped frontend data.
14. Client cannot access employee-only endpoints.
15. Client cannot access other client organizations.
16. Writer cannot access agency settings.
17. Owner can manage memberships.
18. Manager cannot assign OWNER unless explicitly allowed.
19. Suspended membership is excluded from active workspaces.
20. Removed membership prevents future access.
21. Invalid agency ID is rejected.
22. User cannot access another agency by editing URL parameters.
23. Frontend-provided roles are ignored.
24. Frontend-provided permissions are ignored.
25. Duplicate invitation does not create duplicate membership.
26. Existing user invited to another agency reuses the universal UUID.
27. Creating another agency preserves previous memberships.
28. Role update changes effective permissions.
29. Removing a role removes its permissions.
30. Cache is invalidated after role or membership change.
31. Last OWNER cannot remove ownership without transfer.
32. Multiple roles in one agency display one workspace entry.
33. Client organization remains separate from universal identity.
34. Multiple client contacts can belong to one client organization.
35. Legacy employee records migrate correctly.
36. Legacy client-contact records migrate correctly.
37. Duplicate legacy records are reported without destructive deletion.
38. Notifications from another agency require verified workspace access.
39. In-flight previous-agency data does not overwrite selected-workspace state.
40. Agencies summary is generated from membership data and not treated as authoritative.

# Seed and demo data

Create development seed data demonstrating:

User:

surya@example.com

Memberships:

Agency A:
- OWNER
- EDITOR
- WRITER

Agency B:
- CLIENT

Agency C:
- MANAGER

Agency D:
- CLIENT
- REVIEWER

Expected result:

- one universal user UUID
- four agency memberships
- seven membership-role records
- four workspace switcher entries
- no duplicate Agency A or Agency D entries
- correct role labels
- correct navigation for each agency
- correct permissions for each agency
- correct dashboard route for each agency
- correct client isolation for Agency B and Agency D

Also add:

- one pending employee invitation
- one pending client invitation
- one suspended membership
- one duplicate legacy record for migration-test coverage
- one client organization with multiple client contacts

# UI quality requirements

Preserve the existing AGOS visual language.

The implementation must:

- work on desktop and mobile
- support keyboard navigation
- use semantic HTML
- include appropriate ARIA labels and states
- support Escape to close menus
- clearly indicate the active workspace
- display multiple roles cleanly
- truncate long agency names gracefully
- show loading and error states
- provide retry behavior
- avoid full-page reload where practical
- avoid stale-data flashes
- avoid unauthorized navigation flashes
- avoid duplicate workspace entries
- keep the switcher usable with many agencies
- close after a successful switch

# Documentation

After implementation, add or update documentation explaining:

1. Universal identity model
2. Why one normalized email maps to one UUID
3. Email-normalization rules
4. Agency membership model
5. Membership role model
6. Why roles are agency-scoped
7. Client organization versus client user
8. Why agencies JSON is a derived read model
9. Authentication and identity-resolution flow
10. First-login membership-claiming flow
11. Employee onboarding flow
12. Client onboarding flow
13. Role-update flow
14. Workspace-switching flow
15. Default-dashboard resolution
16. Permission model
17. Backend tenant-isolation model
18. Frontend cache invalidation
19. Notification agency context
20. Audit logging
21. Legacy migration
22. Security considerations
23. Instructions for adding future roles and permissions
24. Manual testing instructions

Include Mermaid diagrams.

Identity diagram:

flowchart TD
    A[Verified Email] --> B[Universal User UUID]

    B --> C[Agency A Membership]
    B --> D[Agency B Membership]
    B --> E[Agency C Membership]
    B --> F[Agency D Membership]

    C --> C1[OWNER]
    C --> C2[EDITOR]
    C --> C3[WRITER]

    D --> D1[CLIENT]

    E --> E1[MANAGER]

    F --> F1[CLIENT]
    F --> F2[REVIEWER]

Client relationship diagram:

flowchart TD
    A[Universal User] --> B[Agency Membership: CLIENT]
    B --> C[Client Contact]
    C --> D[Client Organization]
    D --> E[Projects]
    D --> F[Campaigns]
    D --> G[Invoices]
    D --> H[Approvals]

Login-resolution diagram:

flowchart TD
    A[Authentication succeeds] --> B[Read verified email]
    B --> C[Normalize email]
    C --> D{Universal user exists?}
    D -->|Yes| E[Reuse user]
    D -->|No| F[Create universal user]
    E --> G[Find matching pending memberships]
    F --> G
    G --> H[Claim eligible memberships]
    H --> I[Load active memberships and roles]
    I --> J[Calculate permissions]
    J --> K[Resolve active workspace]
    K --> L[Return session and workspace context]

# Implementation constraints

- Do not introduce a second authentication system.
- Do not create separate login systems for clients and employees.
- Do not duplicate users per agency.
- Do not store one global agency role on the user.
- Do not use the agencies JSON object as the source of truth.
- Do not trust frontend-provided roles.
- Do not trust frontend-provided permissions.
- Do not trust agencyId without membership validation.
- Do not break existing agency creation.
- Do not remove legacy employee or client data without a verified migration.
- Do not rewrite unrelated modules.
- Do not install heavy dependencies without justification.
- Do not use mock authorization in production code paths.
- Do not leave security checks as TODO comments.
- Do not expose cross-tenant data.
- Do not change styling unnecessarily.
- Do not claim completion while relevant tests fail.
- Do not silently ignore ambiguous migration records.
- Do not authorize using stale cache alone.
- Do not make dual writes to normalized tables and JSON required for correctness.

# Implementation phases

Implement in this order.

## Phase 1: Repository analysis

- inspect repository
- document existing architecture
- identify data models
- identify authentication flow
- identify onboarding flows
- identify authorization logic
- identify migration risks
- provide implementation plan

Do not modify code until the plan is presented.

## Phase 2: Schema and migration design

- universal identity changes
- normalized email
- agency membership model
- membership roles
- client-contact linkage
- unique constraints
- legacy migration
- migration reporting

## Phase 3: Authentication and identity resolution

- login identity resolution
- universal-user creation/reuse
- pending membership lookup
- membership claiming
- current-user/session endpoint
- default workspace resolution

## Phase 4: Authorization and active workspace

- role-permission mapping
- effective-permission resolver
- backend membership middleware
- backend permission middleware
- active workspace context
- workspace-selection API
- last-workspace persistence

## Phase 5: Employee and client onboarding

- employee invitation integration
- client-contact onboarding
- pending memberships
- duplicate prevention
- legacy compatibility
- role-assignment restrictions

## Phase 6: Frontend workspace behavior

- workspace context
- current-user data loading
- workspace switcher
- role labels
- permission-aware navigation
- default-dashboard resolver
- loading/error states
- cache invalidation
- stale-request protection

## Phase 7: Notifications, audit, and cache

- agency-scoped notifications
- workspace-aware notification navigation
- audit events
- optional derived agencies cache
- cache invalidation
- session refresh after access changes

## Phase 8: Tests, seed data, and documentation

- automated tests
- migration tests
- seed scenario
- accessibility verification
- security review
- architecture documentation
- manual test instructions

After every phase:

- run migrations where applicable
- run formatter
- run lint
- run type checking
- run unit tests
- run integration tests
- run frontend tests
- fix failures before continuing

# Final delivery

At completion, provide:

1. Existing architecture summary
2. Final identity architecture
3. Database changes
4. Migration changes
5. API changes
6. Authentication changes
7. Frontend changes
8. Authorization model
9. Client-account relationship model
10. Cache strategy
11. Notification changes
12. Audit changes
13. Security protections added
14. Tests added
15. Test results
16. Migration instructions
17. Rollback or recovery considerations
18. Assumptions
19. Unresolved risks
20. Exact manual steps to test the Surya multi-agency scenario

Manual verification must include:

1. Log in as surya@example.com.
2. Confirm one universal user identity exists.
3. Confirm four workspace entries appear.
4. Confirm Agency A displays Owner, Editor, Writer.
5. Confirm Agency B displays Client.
6. Confirm Agency C displays Manager.
7. Confirm Agency D displays Client, Reviewer.
8. Switch through all four agencies.
9. Confirm dashboard, navigation, roles, and permissions update.
10. Confirm no data from the previous agency remains visible.
11. Confirm client workspaces cannot access internal agency data.
12. Confirm direct cross-agency URL manipulation is rejected.
13. Confirm a pending employee membership is claimed on first login.
14. Confirm a pending client membership is claimed on first login.
15. Confirm role removal updates access.
16. Confirm suspended memberships cannot be selected.
17. Confirm creating another agency preserves all previous memberships.

Do not claim completion unless all relevant tests pass.

The most important invariant is:

One normalized email maps to one universal UUID.

Membership and role tables are the authoritative source of truth.

Agency access, roles, and permissions are always resolved server-side for the selected agency.

The agencies JSON object is generated for convenient frontend consumption and must never become a separately maintained authorization source.