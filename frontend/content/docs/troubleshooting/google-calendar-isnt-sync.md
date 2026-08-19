---
title: Google Calendar isn't updating
description: Troubleshoot missing or outdated AGENCIE work in Google Calendar.
category: Troubleshooting
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
status: AVAILABLE
---

## Start In AGENCIE

When Google Calendar does not show the work you expect, first check the underlying item in AGENCIE.

AGENCIE is the source of truth for:

- Assignments
- Workflow state
- Deadlines
- Scheduled work
- Production responsibility

Google Calendar is an external view of supported AGENCIE work.

## Check Your Connection

Open **Calendar** in AGENCIE and confirm that Google Calendar is connected.

Make sure the connected Google account is the one whose calendar you are checking.

If the connection is no longer active, reconnect Google Calendar where available.

## Check The Assignment

Having the correct role does not automatically make every matching task appear in your Google Calendar.

For example:

Editor
→ Can perform editing work

Assigned Editor
→ Owns this specific editing task

If an expected task is missing, check whether you are actually the current assignee or owner.

## Check The Date

Calendar synchronization requires meaningful scheduling information.

Check whether the underlying work has the expected:

- Due date
- Scheduled date
- Publishing date or time
- Other supported calendar timing

A task can exist in Workflow or My Work without having enough scheduling information to appear as a calendar event.

## Check The Current Workflow State

Responsibility can move between people as production progresses.

For example:

Writer
→ Script Review
→ DOP
→ Editor
→ Edit Review

When the workflow changes stage, the person responsible for the current work can also change.

If an event you previously expected is no longer relevant to you, check the current workflow owner before treating it as a synchronization problem.

## Check AGENCIE Calendar

Open the Calendar inside AGENCIE.

If the expected work is also missing there, investigate the underlying assignment, deadline, schedule, or workflow state first.

If AGENCIE shows the correct work but Google Calendar does not, then the issue is more likely related to the Google Calendar connection or synchronization.

## Check The Correct Google Account

If you use multiple Google accounts, make sure you are viewing the calendar connected to AGENCIE.

Connecting one Google account does not make AGENCIE events appear automatically in every Google account you use.

## After A Recent Change

When supported work changes in AGENCIE, the corresponding Google Calendar information may need to synchronize.

Do not recreate the underlying task simply because the Google Calendar event appears outdated.

First verify that the AGENCIE record itself contains the correct:

1. Assignment
2. Deadline or scheduled date
3. Workflow state
4. Agency context

The underlying work should remain the authoritative record.

## Do Not Edit Around A Sync Problem

Changing an event directly in Google Calendar should not be treated as a replacement for updating the underlying work in AGENCIE.

For production changes, return to AGENCIE and update the relevant task, schedule, assignment, or workflow where your permissions allow it.

> [!IMPORTANT] AGENCIE Is The Source Of Truth
> Google Calendar provides visibility into supported scheduled work. It does not replace AGENCIE's workflow, assignment, or production state.

## Troubleshooting Checklist

If an expected event is missing or outdated, check:

1. Google Calendar is still connected.
2. You are viewing the connected Google account.
3. The work exists correctly in AGENCIE.
4. You are the relevant assignee where assignment is required.
5. The work has the required deadline or scheduled date.
6. The workflow has not moved responsibility to another person.
7. The work type is supported by Google Calendar synchronization.
8. Your agency membership is still active.

If all of these are correct and Google Calendar still does not reflect the supported AGENCIE work, treat it as a synchronization issue rather than changing assignments or creating duplicate work.

> [!TIP] Diagnose From The Inside Out
> Check the underlying work first, then AGENCIE Calendar, then Google Calendar. If the source is wrong, fix the source. If the source is right but the external calendar is wrong, investigate synchronization.