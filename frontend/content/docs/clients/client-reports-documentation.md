---
title: Client reports & notifications
description: Upload client reports and schedule automatic report notifications for the client's Primary Contact.
category: Clients
order: 3
roles:
  - OWNER
  - ADMIN
  - MANAGER
  - SOCIAL_MEDIA_MANAGER
  - MEMBER
status: AVAILABLE
---

## Uploading Reports & Client Notifications

AGENCIE separates **report uploads** from **client notifications**.

Uploading a file does **not** immediately notify the client.

This allows your team to:

- Upload multiple reports
- Replace files
- Organize monthly documents
- Review the reporting package
- Complete all required uploads before notifying the client

Client report notifications are sent only through the configured **Report Notification** schedule.

## Who Receives Report Notifications

A business client can have multiple CLIENT users with access to its client-facing workspace.

However, scheduled report notifications are sent only to the client's designated **Primary Contact**.

For example:

Client A
├── Maya — CLIENT + Primary Contact
├── Arun — CLIENT
└── Priya — CLIENT

All three users can have permitted access to Client A's Files area.

When a scheduled report notification is sent:

Maya
→ Receives the notification email

Arun
→ Does not receive the notification email

Priya
→ Does not receive the notification email

This prevents every client user from receiving duplicate operational emails while allowing multiple people to retain portal access.

> [!IMPORTANT] Primary Contact Receives Client Emails
> Scheduled client report notifications are sent only to the business client's Primary Contact. Other CLIENT users can continue accessing permitted client resources but do not receive the report notification email.

## Primary Contact Requirement

Report notifications depend on the client having a valid Primary Contact.

The Primary Contact must be an AGENCIE user with CLIENT access to that business client.

Primary Contact is separate from general CLIENT access.

**CLIENT access**
→ Determines who can access supported client-facing resources.

**Primary Contact**
→ Determines who receives supported automated client communication.

Changing the Primary Contact therefore changes the recipient of future report notifications without removing the previous Primary Contact's CLIENT access.

For example:

Before:

Client A
├── Maya — CLIENT + Primary Contact
└── Arun — CLIENT

Primary Contact changed to Arun:

Client A
├── Maya — CLIENT
└── Arun — CLIENT + Primary Contact

Future report notifications are sent to Arun.

Maya keeps her existing CLIENT access unless it is separately removed.

## Uploading Reports

You can upload as many files as required for a client's reporting period.

Files can be organized by:

- Reporting month and year
- Report category
- Client

Uploading, replacing, or managing files does not trigger an email.

This means your team can prepare the complete reporting package without sending multiple notifications for individual uploads.

---

## Report Notifications

Instead of notifying the Primary Contact after every upload, you can configure a recurring **Report Notification** for each client.

Once configured, AGENCIE automatically checks for reports at the scheduled time.

If reports are available for the relevant reporting period, AGENCIE sends a report-ready notification to the client's current Primary Contact.

The notification links to the client's Files area.

## Monthly Notifications

Monthly notifications are best when your agency shares one reporting package per month.

We recommend:

**Last working day of every month**

You can choose:

- **First day of every month**
  - Notifies the Primary Contact about the previous month's reports.

- **First working day of every month**
  - Notifies the Primary Contact about the previous month's reports.

- **Last day of every month**
  - Notifies the Primary Contact about the current month's reports.

- **Last working day of every month — Recommended**
  - Notifies the Primary Contact about the current month's reports.

- **Before the end of every month**
  - Choose 1, 2, 3, 5, or 7 days before the end of the month.
  - Notifies the Primary Contact about the current month's reports.

For scheduling purposes, working days currently mean Monday through Friday.

## Weekly Notifications

Weekly notifications are best when your agency updates performance reports throughout the month.

We recommend:

**Friday**

You can choose any weekday from Monday through Sunday.

Weekly notifications also use the selected:

- Send time
- Timezone
- Enabled or disabled state

Weekly notifications tell the Primary Contact that the client's latest performance reports have been updated.

Uploaded files are still organized by reporting month in AGENCIE.

---

## Example

Suppose your agency prepares monthly reports for a client throughout August.

The client has three CLIENT users:

Client
├── Maya — Primary Contact
├── Arun
└── Priya

You configure:

**Schedule:** Last working day of every month  
**Time:** 10:00 AM  
**Timezone:** Asia/Kolkata

Your team can upload reports throughout August without sending client emails.

On the last working day of August, AGENCIE checks whether August reports are available.

If reports exist:

1. AGENCIE identifies the reporting period.
2. AGENCIE confirms that reports are available.
3. AGENCIE resolves the client's current Primary Contact.
4. Maya receives the report-ready notification.
5. Arun and Priya are not emailed.
6. The notification links directly to the client's Files area.
7. The recurring schedule moves to its next scheduled occurrence.

The agency does not need to recreate the schedule every month.

---

## What Happens If No Reports Are Uploaded?

AGENCIE checks for reports before sending the scheduled notification.

If no active reports exist for the scheduled reporting period:

- No email is sent.
- No misleading "reports are ready" notification is sent.
- The notification is recorded as skipped.
- The agency can see:

> **No reports were available at the scheduled time.**

The recurring schedule remains active for future reporting periods.

Uploading reports after a notification has been skipped does **not** automatically send an email for that reporting period.

This prevents file uploads from unexpectedly triggering client communication.

---

## What Happens If The Primary Contact Changes?

Report notification schedules belong to the business client, not permanently to a particular recipient.

If the Primary Contact changes, future scheduled notifications use the client's current Primary Contact.

For example:

Monday:

Client A
→ Primary Contact: Maya

Thursday:

Primary Contact changed:

Client A
→ Primary Contact: Arun

Friday scheduled notification:

Arun
→ Receives the report notification

Maya
→ Does not receive the report notification

You do not need to recreate the report notification schedule after changing the Primary Contact.

This keeps communication ownership synchronized with the current client configuration.

---

## Multiple CLIENT Users

Giving additional users CLIENT access does not subscribe them to report notification emails.

For example:

Client A
├── Maya — Primary Contact
├── Arun — CLIENT
├── Priya — CLIENT
└── Daniel — CLIENT

All four users can have supported access to Client A.

Only Maya receives scheduled report-ready emails.

This allows agencies to provide portal access to multiple client stakeholders without sending every operational notification to every stakeholder.

---

## Changing Or Disabling Notifications

Agencies can edit the notification schedule for each client.

You can change:

- Notification frequency
- Notification schedule
- Notification time
- Timezone
- Whether notifications are enabled

Changing the schedule does not change the client's Primary Contact.

Changing the Primary Contact does not change the notification schedule.

These settings remain separate:

**Notification schedule**
→ Determines when communication is sent.

**Primary Contact**
→ Determines who receives it.

Disabling notifications does not affect uploaded reports.

CLIENT users can continue accessing reports they already have permission to view.

---

## Recommended Workflow

For most agencies, we recommend:

**Last working day of every month**

A typical monthly workflow is:

1. Confirm that the client has the correct Primary Contact.
2. Upload reports throughout the month.
3. Review and organize the client's reporting files.
4. Complete all uploads before the scheduled notification time.
5. AGENCIE checks that reports are available.
6. The client's Primary Contact receives one consolidated report-ready notification.
7. Other CLIENT users retain their portal access without receiving duplicate emails.
8. Continue uploading normally for the next reporting period.

This avoids unnecessary emails while giving clients a predictable reporting schedule.

For weekly reporting, we recommend:

**Friday**

This gives your team the week to update reports while giving the client's Primary Contact a predictable weekly review point.

---

## Important

**Uploading a report never sends an immediate client email.**

Client report emails are sent only through the configured Report Notification schedule.

**Only the client's current Primary Contact receives the scheduled report notification.**

Other CLIENT users do not receive the email simply because they have access to the client.

If no notification schedule is configured, reports remain available in AGENCIE but no automated report-ready email is sent.