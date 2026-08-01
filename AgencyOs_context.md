# AGOS (Agency Operating System)

## Vision

AGOS is a multi-tenant SaaS platform that helps creative agencies manage their entire content production lifecycle.

The goal is to replace fragmented workflows spread across:

- WhatsApp
- Notion
- Excel
- Google Drive
- Phone Calls

with one workflow-driven platform.

AGOS is not a social media scheduler.

It is an Operating System for Creative Agencies.

---

# Target Customer

Small to medium creative agencies.

Typical team:

- Founder
- Manager
- Script Writers
- DOPs
- Editors
- Designers
- Social Media Managers

The founder currently manages everything manually.

AGOS removes operational chaos without adding enterprise complexity.

---

# Product Philosophy

Keep everything Lean.

Every feature must solve a real workflow problem.

Never build because competitors have it.

No unnecessary abstraction.

No premature optimization.

Simple UI.

Powerful backend.

---

# Core Workflow

Client

↓

Campaign

↓

Content Asset

↓

Workflow Instance

↓

Workflow Tasks

↓

Submissions

↓

Approvals

↓

Publishing

Every piece of content moves through this pipeline.

---

# Product Principles

1. Workflow is the source of truth.
2. Calendar mirrors workflow.
3. Notifications mirror workflow.
4. Never duplicate business logic.
5. Everything is event-driven.
6. Everything is tenant isolated.
7. Security by default.
8. Founder should never micromanage.

---

# Architecture

Microservices.

Current services:

- API
- Auth
- User
- Organization
- Client
- Campaign
- Workflow
- Notification
- WebSocket

Planned:

- Calendar
- Billing
- Analytics
- Search
- Media

Communication:

RabbitMQ

Persistence:

Transactional Outbox Pattern

Caching:

Redis

Database:

PostgreSQL

ORM:

Prisma

Backend:

NestJS

Frontend:

Next.js

Realtime:

WebSocket Service

Notifications:

Independent Notification Service

---

# Security Principles

OAuth first.

Google Login is primary authentication.

JWT Access Token

Opaque Refresh Token

HttpOnly Cookies

AES-256 field encryption

Blind indexing for searchable PII

Argon2id password hashing

Protected by default.

Every request resolves:

User

↓

Agency

↓

Membership

↓

Permissions

---

# Multi Tenancy

One user can belong to multiple agencies.

Every request operates inside exactly one agency.

Every business entity belongs to an agency.

Future roadmap:

Each agency receives its own database for complete data isolation.

Platform database stores only:

- authentication
- agencies
- memberships
- billing
- tenant routing

Agency databases store:

- clients
- campaigns
- workflows
- calendars
- notifications
- business data

---

# Development Methodology

Vertical Slice Development.

Each phase delivers one complete business capability.

Never build half features.

Every phase must include:

Repository

↓

Service

↓

Controller

↓

Validation

↓

Tests

↓

Swagger

↓

Events

---

# Current Implementation Status

## Phase 0

Foundation

Completed

- Logging
- Request Context
- Exception Filter

---

## Phase 1

Authentication

Completed

- Register
- Login
- Refresh
- Logout
- Session Management

---

## Phase 1.5

OAuth

Completed

Google Login implemented.

Provider identities implemented.

---

## Phase 2

User Module

Completed

User provisioning through events.

RabbitMQ.

Outbox Relay.

---

## Phase 3

Organization Module

Completed

Agency creation.

Invitations.

Memberships.

System Roles.

---

## Phase 4

Gateway Security

Completed

JWT Guard

Tenant Guard

Permission Guard

Security Context

Protected by default.

---

## Phase 5

Client Module

Completed

CRUD

Archive

Restore

Assign Manager

Tenant isolation

---

## Phase 6

Campaign Module

Completed

Planning container.

CRUD

Archive

Restore

Lifecycle.

---

## Phase 7

Workflow Engine

Completed

Workflow Templates

Workflow Instances

Workflow Tasks

Transitions

Assignment History

Submissions

Approvals

Blockers

Workflow Engine

---

## Phase 8

Content Pipeline

Completed

Content Assets

Stage transitions

Workflow integration

Submission lifecycle

---

## Phase 9

Dashboard Foundation

Completed

Founder dashboard backend

Statistics

KPIs

Overview APIs

---

# Frontend Status

Current stack:

Next.js

TypeScript

Tailwind

Dark UI

Current pages:

Landing Page

Completed.

Hero

Features

Workflow

Pricing

FAQ

Next implementation:

Google Login

↓

Create Agency

↓

Welcome

↓

Dashboard

↓

Create Client

↓

Create Campaign

↓

Create Content

↓

Workflow

---

# Workspace Branding

Marketing site:

agos.com

Application:

agency.agos.com

Inside application:

Never display "AGOS" prominently.

Display agency name.

Example:

socialexpert.agos.com

Sidebar:

Social Expert

Dashboard

Clients

Campaigns

Content

Workflow

Settings shows:

Powered by AGOS

---

# Notification Philosophy

Notifications are first-class features.

Every meaningful workflow event produces notifications.

Channels:

In App

Email

WhatsApp

WebSocket

Future:

Slack

Teams

Discord

Webhook

Notification Service decides delivery.

Workflow never directly sends messages.

---

# Calendar Philosophy

Workflow owns scheduling.

Calendar mirrors workflow.

Every task becomes calendar event.

Supported:

Google Calendar

Future:

Outlook

Apple Calendar

ICS Feed

Never let Calendar become the source of truth.

Workflow always owns state.

---

# Coding Standards

Prefer composition.

Prefer explicit code.

Avoid magic.

Avoid over engineering.

No duplicate APIs.

Every write operation emits domain events.

Repositories remain database-only.

Business logic belongs in Services.

Controllers stay thin.

Every module includes unit tests.

Every endpoint documented.

Use optimistic locking.

Use transactions for consistency.

No shared mutable state.

---

# End Goal

Agency owner should be able to:

Discover AGOS

↓

Login with Google

↓

Create Agency

↓

Invite Employees

↓

Create Client

↓

Create Campaign

↓

Create Content

↓

Assign Team

↓

Track Workflow

↓

Receive Notifications

↓

View Calendar

↓

Deliver Content

↓

Scale Agency

without needing:

WhatsApp

Excel

Notion

Manual follow-ups

or micromanagement.

AGOS should become the operating system of a creative agency.

---

# Immediate Next Milestones

Frontend:

- Google Login
- Create Agency page
- Welcome flow
- Founder Dashboard
- Client pages
- Campaign pages
- Workflow pages

Backend:

- Calendar Service
- Notification Preferences
- Email Delivery
- WhatsApp Delivery
- Billing
- Tenant Database Provisioning
- Analytics
- Search

---

# AI Agent Instructions

When implementing code:

- Follow existing architecture.
- Reuse existing services whenever possible.
- Never duplicate business logic.
- Respect module boundaries.
- Emit domain events for writes.
- Keep controllers thin.
- Write tests.
- Update Swagger.
- Follow Vertical Slice methodology.
- Keep implementation Lean.
- Prioritize maintainability over cleverness.