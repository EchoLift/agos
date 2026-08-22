---
title: Client reports & notifications
description: Upload client reports and schedule automatic report notifications when reports are ready.
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

Uploading a file does **not** immediately notify the client. This allows your team to upload multiple reports, replace files, organize monthly documents, and complete the reporting package before the client receives an email.

### Uploading reports

You can upload as many files as required for a client's reporting period.

Files can be organized by:

- Reporting month and year
- Report category
- Client

Uploading, replacing, or managing files does not trigger an email to the client.

This means you can prepare the complete reporting package without sending multiple notifications for individual uploads.

---

## Report Notifications

Instead of notifying clients after every upload, you can configure a recurring **Report Notification** for each client.

Once configured, AGENCIE automatically checks for reports at the scheduled time and notifies the client when reports are available.

### Monthly notifications

Monthly notifications are best when your agency shares one reporting package per month. We recommend:

**Last working day of every month**

You can choose:

- **First day of every month**
  - Notifies the client about the previous month's reports.

- **First working day of every month**
  - Notifies the client about the previous month's reports.

- **Last day of every month**
  - Notifies the client about the current month's reports.

- **Last working day of every month — Recommended**
  - Notifies the client about the current month's reports.

- **Before the end of every month**
  - Choose 1, 2, 3, 5, or 7 days before the end of the month.
  - Notifies the client about the current month's reports.

For scheduling purposes, working days currently mean Monday through Friday.

### Weekly notifications

Weekly notifications are best when your agency updates performance reports throughout the month.

We recommend:

**Friday**

You can choose any weekday from Monday through Sunday. Weekly notifications also use the selected send time, timezone, and enabled or disabled state.

Weekly notifications tell the client that their latest performance reports have been updated. Uploaded files are still organized by reporting month in AGENCIE.

---

## Example

Suppose your agency prepares monthly reports for a client throughout August.

You configure:

**Schedule:** Last working day of every month  
**Time:** 10:00 AM  
**Timezone:** Asia/Kolkata

Your team can upload reports throughout August without notifying the client.

On the last working day of August, AGENCIE checks whether August reports are available.

If reports exist:

1. AGENCIE identifies eligible client users.
2. The client receives a report-ready notification.
3. The notification links directly to the client's Files area.
4. The schedule automatically moves to the next month.

The agency does not need to recreate the schedule every month.

---

## What happens if no reports are uploaded?

AGENCIE checks for reports before sending the scheduled notification.

If no active reports exist for the scheduled reporting period:

- No email is sent.
- No misleading "reports are ready" notification is sent.
- The notification is recorded as skipped.
- The agency can see:

> **No reports were available at the scheduled time.**

The recurring schedule remains active for future months.

Uploading reports after a notification has been skipped does **not** automatically send an email for that month.

This prevents file uploads from unexpectedly triggering client communication.

---

## Test emails

Agencies can send a test report notification before saving or changing a schedule.

Test emails:

- Are sent only to the agency user who requests the test.
- Do not notify the client.
- Use the current form values shown in the schedule modal.
- Include the real client portal link so routing can be verified.
- Do not change the saved schedule.
- Do not affect future scheduled notifications.

---

## Changing or disabling notifications

Agencies can edit the notification schedule for each client.

You can change:

- Notification frequency
- Notification schedule
- Notification time
- Timezone
- Whether notifications are enabled

Disabling notifications does not affect uploaded reports. Clients can continue accessing reports they already have permission to view.

---

## Recommended workflow

For most agencies, we recommend:

**Last working day of every month**

A typical monthly workflow is:

1. Upload reports throughout the month.
2. Review and organize the client's reporting files.
3. Complete all uploads before the scheduled notification time.
4. AGENCIE checks that reports are available.
5. The client receives one consolidated report-ready notification.
6. Continue uploading normally for the next reporting period.

This avoids unnecessary emails while giving clients a predictable reporting schedule.

For weekly reporting, we recommend:

**Friday**

This gives your team the week to update reports while giving clients a predictable weekly review point.

---

## Important

**Uploading a report never sends an immediate client email.**

Client report emails are sent only through the configured Report Notification schedule.

If no notification schedule is configured, reports remain available in AGENCIE but no automated report-ready email is sent.
