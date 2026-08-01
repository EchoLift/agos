# Frontend Phase 1 — Customer Activation Journey

**Status:** Core activation flow implemented locally

**Goal:** A brand-new agency founder can discover AGOS, create their workspace, and manage their first client in under 5 minutes.

---

## Product Philosophy

### AGOS is the product.
The agency is the brand.

There are two completely different experiences.

Marketing Website

```
agos.com
↓
Agency OS Branding
↓
Acquire Customers
```

Application

```
{agencySlug}.agos.com
↓
Social Expert Branding
↓
Run Their Business
```

Once a founder creates an agency, the platform should fade into the background. The agency becomes the identity.

---

## Customer Journey

```
Visitor
↓
Landing Page
↓
Google Login
↓
Create Agency
↓
Workspace Ready
↓
Activation
↓
Dashboard
```

No unnecessary onboarding. Every screen moves the user toward value.

---

## Activation

The first workspace experience is not a welcome page.
It is activation: a guided path that gets the founder to real work.

## Roadmap v2: capability-first product delivery
The next frontend work should follow the same principle as the backend: every milestone should ship a usable capability for a founder or team member.

### Frontend roadmap
- ✅ Phase A — Marketing: landing, pricing, docs, and blog experience
- ✅ Phase B — Activation: login, agency creation, and workspace shell
- ⬜ Phase C — Founder Experience: dashboard, clients, campaigns, content, and workflow screens wired to the existing APIs
- ⬜ Phase D — Employee Experience: role-specific dashboards for writer, editor, DOP, designer, and manager
- ⬜ Phase E — Founder Settings: agency, members, roles, workspace, and billing experience
- ⬜ Phase F — Collaboration: notifications, calendar, activity, and comments without adding chat-first complexity

### Product milestones
- Milestone 1: founder can create a client.
- Milestone 2: founder can create a campaign.
- Milestone 3: writer can submit a script.
- Milestone 4: manager can approve it.
- Milestone 5: founder can see the work on the dashboard.

This keeps the UI aligned with real operational needs instead of building empty pages.

Instead of "Welcome to Agency OS," the initial activation screen should say:

```
Let's set up your first workspace.

✓ Create Client

○ Create Campaign

○ Create Content

○ Start Workflow
```

As soon as "Create Client" finishes, animate the progress mark to `✓` and continue the activation path automatically.

The dashboard is the reward at the end of activation, not the starting point.

---

## Phase 1 Scope

### 1. Landing Website

Host
```
agos.com
```
Purpose
Acquire customers.

Sections
```
Hero
Problem
Workflow
Features
Dashboard Preview
Pricing
FAQ
Footer
```

Hero uses the particle background. No particles anywhere else.

---

### 2. Authentication

Host
```
agos.com/login
```

Only
```
Continue with Google
```

No email/password.
No registration form.
Authentication exists only to get users into their workspace.

Status
```
Implemented locally with a backend auth exchange; a real Google client ID is still needed for production-grade OAuth.
```

---

### 3. Agency Creation

Immediately after first login.

Screen
```
What's your agency called?

_____________________

Create Agency
```

Nothing else.

Do not ask
- logo
- address
- GST
- industry
- timezone
- phone
- employees

All optional.

---

### 4. Workspace Provisioning

After successful creation

Backend
```
Create Agency
↓
Seed Roles
↓
Create Membership
↓
Set Active Agency
↓
Generate Slug
↓
Create Workspace
```

Frontend
Redirect automatically
```
/{agencySlug}
```

Status
```
Path-based dynamic workspace routing is implemented and verified; host-based subdomain routing is planned next.
```

No confirmation screen. No "Success." Just continue.

---

### 5. Workspace Branding

Everything changes.

Navigation
Instead of
```
Agency OS
```
Display
```
Social Expert
```

Browser title
```
Dashboard • Social Expert
```

Sidebar
```
🟣 Social Expert
Dashboard
Clients
Campaigns
Content
Workflow
```

Only Settings mentions AGOS.

```
Powered by AGOS
```

---

## Subdomain Architecture

Marketing
```
agos.com
```

Application
```
{agencySlug}.agos.com
```

Examples
```
socialexpert.agos.com
pixelhouse.agos.com
visionmedia.agos.com
```

Routing
```
Landing
↓
Login
↓
Agency Creation
↓
Redirect
↓
Workspace
```

Users should almost never return to
```
agos.com
```

---

## Slug Rules

Agency Name
```
Social Expert
```
Slug
```
socialexpert
```

Rules
- lowercase
- remove spaces
- remove special characters
- no hyphens unless required
- append suffix only on collision

Examples
```
Social Expert
↓
socialexpert

Already exists
↓
socialexpert2
```

---

## Founder Dashboard (Empty State)

Do not show blank tables.

Instead
```
Your agency is ready.

Let's onboard your first client.
```

Empty states teach the product.

---

## Guided Activation

Instead of
```
Dashboard
↓
User explores
```
Guide them.

```
Create Client
↓
Create Campaign?
↓
Create Content?
↓
Assign Workflow?
```

Every action unlocks the next.

---

## Navigation Philosophy

Do **not** build every page first.
Build the activation happy path.

```
Landing
↓
Google Login
↓
Create Agency
↓
Create Client
↓
Create Campaign
↓
Create Content
↓
Start Workflow
↓
Dashboard
```

The dashboard should answer one question:

> What needs my attention?

Not "Welcome." Not "Getting started." Those belong to activation.

Keep the sidebar tiny:

```
Dashboard
Clients
Campaigns
Content
Workflow
```

Members, notifications, and settings can wait until after the product has delivered value.

---

## Frontend Phases

### Phase 1 — Customer Acquisition

```
Landing
↓
Login
↓
Agency
```

### Phase 2 — Customer Activation

```
Client
↓
Campaign
↓
Content
↓
Workflow
```

### Phase 3 — Workspace

```
Dashboard
Clients
Campaigns
Content
Workflow
```

### Phase 4 — Team Collaboration

```
Members
Invitations
Notifications
```

### Phase 5 — Founder Experience

```
Analytics
Reports
Calendar
Settings
```

This roadmap is customer-centric instead of page-centric.

---

## Branding Rules

Marketing
```
Agency OS
```

Application
```
Social Expert
```

Emails
```
Social Expert invited you
```

Browser Title
```
Dashboard • Social Expert
```

Settings
```
Powered by AGOS
```

Documentation
```
Agency OS Docs
```

Support
```
AGOS Support
```

---

## Future (Out of Scope)

Do not build now.

### Custom Domains

```
workspace.socialexpert.com
↓
CNAME
↓
AGOS
```

### White Label

Agency Logo
Custom Brand Colors
Custom Email Branding
Custom Login

### Team Switching

```
Social Expert
↓
Pixel House
↓
Vision Media
```

### Multi Workspace

Later.

---

## Technical Notes

### Frontend

- Next.js App Router
- Tailwind CSS
- shadcn/ui
- React Hook Form
- TanStack Query
- ReactBits (hero only)
- Framer Motion (subtle transitions)

### Routing

Marketing App
```
agos.com/*
```
Workspace App
```
{slug}.agos.com/*
```

Middleware responsibilities:
- Detect subdomain
- Resolve workspace slug
- Inject workspace context
- Redirect unknown slugs
- Handle localhost development (e.g. `socialexpert.localhost:3000`)

---

## Definition of Done

- ✅ Landing page complete
- ✅ Google OAuth login
- ✅ Agency creation flow
- ✅ Automatic workspace provisioning
- ✅ Redirect to `{agency}.agos.com`
- ✅ Workspace branding replaces "Agency OS"
- ✅ Guided activation flow for first client / campaign / content / workflow
- ✅ Dashboard shown after activation is complete
- ✅ Entire happy path completable in under **5 minutes**

---

## Success Metric

The milestone is not "frontend complete."

The milestone is:

> **80% of first-time users can create an agency, create a client, create a campaign, create content, start a workflow, and reach the dashboard within 5 minutes without documentation.**
