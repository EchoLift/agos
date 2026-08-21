-- CreateEnum
CREATE TYPE "ReportNotificationScheduleType" AS ENUM ('FIRST_DAY', 'FIRST_WORKING_DAY', 'LAST_DAY', 'LAST_WORKING_DAY', 'DAYS_BEFORE_MONTH_END');

-- CreateEnum
CREATE TYPE "ReportNotificationExecutionStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED_NO_REPORTS', 'FAILED');

-- CreateTable
CREATE TABLE "client_report_notification_schedules" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduleType" "ReportNotificationScheduleType" NOT NULL,
    "daysBeforeMonthEnd" INTEGER,
    "sendTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "client_report_notification_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_report_notification_executions" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reportYear" INTEGER NOT NULL,
    "reportMonth" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReportNotificationExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_report_notification_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_report_notification_schedules_agencyId_clientId_key" ON "client_report_notification_schedules"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "client_report_notification_schedules_enabled_nextRunAt_idx" ON "client_report_notification_schedules"("enabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_report_notification_executions_scheduleId_reportYear_r_key" ON "client_report_notification_executions"("scheduleId", "reportYear", "reportMonth");

-- CreateIndex
CREATE INDEX "client_report_notification_executions_agencyId_clientId_repo_idx" ON "client_report_notification_executions"("agencyId", "clientId", "reportYear", "reportMonth");

-- AddForeignKey
ALTER TABLE "client_report_notification_schedules" ADD CONSTRAINT "client_report_notification_schedules_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_report_notification_schedules" ADD CONSTRAINT "client_report_notification_schedules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_report_notification_schedules" ADD CONSTRAINT "client_report_notification_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_report_notification_executions" ADD CONSTRAINT "client_report_notification_executions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "client_report_notification_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
