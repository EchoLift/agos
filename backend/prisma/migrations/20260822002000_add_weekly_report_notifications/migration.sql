-- Add weekly report notification support while preserving existing monthly rows.

CREATE TYPE "ReportNotificationFrequency" AS ENUM ('MONTHLY', 'WEEKLY');
CREATE TYPE "ReportNotificationWeekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

ALTER TABLE "client_report_notification_schedules"
  ADD COLUMN "frequency" "ReportNotificationFrequency" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "weeklyDay" "ReportNotificationWeekday";

ALTER TABLE "client_report_notification_executions"
  ADD COLUMN "periodStart" TIMESTAMP(3),
  ADD COLUMN "periodEnd" TIMESTAMP(3);

UPDATE "client_report_notification_executions"
SET
  "periodStart" = make_timestamp("reportYear", "reportMonth", 1, 0, 0, 0),
  "periodEnd" = make_timestamp("reportYear", "reportMonth", 1, 0, 0, 0)
    + INTERVAL '1 month'
    - INTERVAL '1 millisecond'
WHERE "periodStart" IS NULL
  OR "periodEnd" IS NULL;

ALTER TABLE "client_report_notification_executions"
  ALTER COLUMN "periodStart" SET NOT NULL,
  ALTER COLUMN "periodEnd" SET NOT NULL;

DROP INDEX "client_report_notification_executions_scheduleId_reportYear_r_key";

CREATE UNIQUE INDEX "client_report_notification_executions_schedule_period_key"
  ON "client_report_notification_executions"("scheduleId", "periodStart", "periodEnd");

CREATE INDEX "client_report_notification_executions_agency_client_period_idx"
  ON "client_report_notification_executions"("agencyId", "clientId", "periodStart", "periodEnd");
