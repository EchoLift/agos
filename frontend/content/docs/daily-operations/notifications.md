---
title: Notifications
description: Understand which AGENCIE events currently send notifications and which notification features are still planned.
category: Daily Operations
order: 7
roles:
  - OWNER
  - ADMIN
  - MANAGER
  - WRITER
  - DOP
  - EDITOR
  - DESIGNER
  - SOCIAL_MEDIA_MANAGER
  - MEMBER
status: PARTIAL
---

## Current Status

AGENCIE currently uses email for selected operational events where someone needs to know about or act on something.

Examples can include:

- Agency invitations
- Direct work assignments
- Review requests
- Requested changes
- Actionable workflow handoffs

AGENCIE follows a simple notification principle:

> Visibility does not deserve an email. Responsibility does.

Events that provide context without requiring immediate action should generally remain inside the workspace rather than generating unnecessary email.

Examples include:

- Campaign creation
- Campaign team changes
- General workflow visibility
- Routine status changes
- Minor metadata updates

## Email Notifications

Email is currently the primary notification channel for supported action-required events.

Invitation emails are also used to onboard new agency users and CLIENT users.

Not every change inside AGENCIE generates an email.

## In-App Notifications

A user-facing in-app notification center is not currently available.

There is currently no notification bell, notification inbox, unread count, or mark-as-read experience in the product UI.

Some notification-related backend infrastructure exists, but it should not be treated as an available user-facing feature.

## Google Calendar

Google Calendar integration is available for supported assigned and scheduled work.

Once connected, supported AGENCIE work can appear in the user's Google Calendar.

Google Calendar is primarily a scheduling and work-visibility integration rather than a replacement for notifications or workflow state inside AGENCIE.

## Where To Check Daily Work

Do not depend on notifications as the primary way to discover work.

Use:

- **My Work** for work directly assigned to you.
- **Workflow** for production progress and handoffs.
- **Calendar** for scheduled work and deadlines.
- **Campaigns** for campaign-level context.

These are the primary operational views in the current version of AGENCIE.

## What Is Partial

The notification system is currently partial.

The following user-facing capabilities are not yet available:

- In-app notification center
- Notification bell
- Unread counts
- Mark-as-read actions
- Notification preferences
- Complete notification history
- Unified cross-channel notification management

## Planned Later

Future notification capabilities may include:

- In-app notification center
- WhatsApp delivery
- Per-user notification preferences
- Read/unread notification state
- Better notification history
- Unified action-required delivery across supported channels

> [!WARNING] Do Not Depend On Notifications Alone
> Use My Work, Workflow, Campaigns, and Calendar as the primary sources for current work. Email notifications currently provide additional support for selected action-required events.