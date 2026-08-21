import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "@packages/database/prisma.service";
import { ConfigService } from "@nestjs/config";
import { NotificationService } from "@modules/notification/notification.service";
import { ReportScheduleCalculatorService } from "@modules/client-analytics/services/report-schedule-calculator.service";
import { buildDeepLink } from "@modules/notification/email/templates/email-templates";
import {
  NotificationDeliveryIntent,
  NotificationRecipientType,
} from "@modules/notification/notification.policy";
import {
  ReportNotificationExecutionStatus,
  ReportNotificationScheduleType,
} from "@prisma/client";

const MAX_ATTEMPTS = 3;

@Injectable()
export class ReportNotificationSchedulerService {
  private readonly logger = new Logger(ReportNotificationSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly scheduleCalculator: ReportScheduleCalculatorService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Poll every minute for due report notification schedules.
   * Uses atomic claim-before-send to prevent duplicate notifications
   * under concurrent worker execution.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processSchedules(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug(
        "Report notification scheduler already running — skipping tick",
      );
      return;
    }
    this.isRunning = true;

    try {
      const now = new Date();

      // Find enabled schedules that are due
      const dueSchedules =
        await this.prisma.clientReportNotificationSchedule.findMany({
          where: {
            enabled: true,
            deletedAt: null,
            nextRunAt: { lte: now },
          },
          include: {
            agency: { select: { id: true, name: true, slug: true } },
            client: { select: { id: true, name: true, timezone: true } },
          },
          take: 50, // Process up to 50 schedules per tick to avoid runaway
        });

      this.logger.log(
        `Found ${dueSchedules.length} due report notification schedule(s)`,
      );

      for (const schedule of dueSchedules) {
        await this.processOneSchedule(schedule, now);
      }
    } catch (error) {
      this.logger.error("Error in report notification scheduler tick", error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processOneSchedule(
    schedule: {
      id: string;
      agencyId: string;
      clientId: string;
      scheduleType: ReportNotificationScheduleType;
      daysBeforeMonthEnd: number | null;
      sendTime: string;
      timezone: string;
      agency: { id: string; name: string; slug: string };
      client: { id: string; name: string; timezone: string | null };
    },
    now: Date,
  ): Promise<void> {
    // Resolve the reporting period for this execution time
    const {
      reportYear,
      reportMonth,
      label: reportPeriodLabel,
    } = this.scheduleCalculator.resolveReportPeriod(
      schedule.scheduleType,
      now,
      schedule.timezone,
    );

    this.logger.log(
      `Processing schedule ${schedule.id} for client ${schedule.clientId} — ` +
        `reporting period: ${reportPeriodLabel}`,
    );

    const executionId = await this.claimExecution(
      schedule,
      reportYear,
      reportMonth,
      reportPeriodLabel,
      now,
    );

    if (!executionId) {
      return;
    }

    // ── REPORT EXISTENCE CHECK ────────────────────────────────────────────────
    const reportCount = await this.prisma.clientAnalyticsAsset.count({
      where: {
        agencyId: schedule.agencyId,
        clientId: schedule.clientId,
        year: reportYear,
        month: reportMonth,
        deletedAt: null,
      },
    });

    if (reportCount === 0) {
      this.logger.log(
        `No reports found for client ${schedule.clientId} period ${reportPeriodLabel}. ` +
          `Recording SKIPPED_NO_REPORTS.`,
      );
      await this.prisma.clientReportNotificationExecution.update({
        where: { id: executionId },
        data: {
          status: ReportNotificationExecutionStatus.SKIPPED_NO_REPORTS,
          updatedAt: now,
        },
      });
      await this.advanceNextRunAt(schedule, now);
      return;
    }

    // ── RESOLVE RECIPIENTS ────────────────────────────────────────────────────
    // Notify users who have client-scoped membership in this specific client
    const clientMemberships = await this.prisma.membership.findMany({
      where: {
        agencyId: schedule.agencyId,
        clientId: schedule.clientId,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        user: {
          include: { authUser: true },
        },
      },
    });

    if (clientMemberships.length === 0) {
      this.logger.log(
        `No active client-scoped members for client ${schedule.clientId}. Recording FAILED for retry.`,
      );
      await this.prisma.clientReportNotificationExecution.update({
        where: { id: executionId },
        data: {
          status: ReportNotificationExecutionStatus.FAILED,
          errorDetails:
            "No active client-scoped members were available to notify.",
          updatedAt: now,
        },
      });
      return;
    }

    // ── SEND NOTIFICATIONS ────────────────────────────────────────────────────
    const frontendUrl =
      this.config.get<string>("FRONTEND_URL") || "https://app.agencie.in";
    const reportsDeepLink = buildDeepLink(
      frontendUrl,
      "/files",
      schedule.agency.slug,
    );

    let recipientCount = 0;
    const errors: string[] = [];

    for (const membership of clientMemberships) {
      const user = membership.user;
      if (!user?.authUser) continue;

      try {
        const recipientName = user.name || "there";

        await this.notificationService.notify({
          agencyId: schedule.agencyId,
          userId: user.id,
          title: `Your ${reportPeriodLabel} reports are ready`,
          body: `${schedule.agency.name} has uploaded your reports for ${reportPeriodLabel}.`,
          eventType: "ClientReportReady",
          deliveryIntent: NotificationDeliveryIntent.ClientActionRequired,
          recipientType: "CLIENT" as NotificationRecipientType,
          metadata: {
            reportYear,
            reportMonth,
            reportPeriodLabel,
            clientId: schedule.clientId,
            deepLink: reportsDeepLink,
          },
        });
        recipientCount++;
        this.logger.log(
          `Notified user ${user.id} (${recipientName}) for period ${reportPeriodLabel}`,
        );
      } catch (notifyErr: any) {
        const errMsg = `Failed to notify user ${user.id}: ${notifyErr?.message}`;
        this.logger.error(errMsg, notifyErr);
        errors.push(errMsg);
      }
    }

    // ── RECORD OUTCOME ────────────────────────────────────────────────────────
    if (errors.length > 0 && recipientCount === 0) {
      // All notifications failed
      await this.prisma.clientReportNotificationExecution.update({
        where: { id: executionId },
        data: {
          status: ReportNotificationExecutionStatus.FAILED,
          errorDetails: errors.join("; "),
          updatedAt: now,
        },
      });
      this.logger.error(
        `All notifications failed for schedule ${schedule.id} period ${reportPeriodLabel}`,
      );
      // Don't advance nextRunAt — allow retry on next tick if within attempt budget
      return;
    }

    await this.prisma.clientReportNotificationExecution.update({
      where: { id: executionId },
      data: {
        status: ReportNotificationExecutionStatus.SENT,
        sentAt: now,
        recipientCount,
        errorDetails: errors.length > 0 ? errors.join("; ") : null,
        updatedAt: now,
      },
    });

    this.logger.log(
      `Schedule ${schedule.id} period ${reportPeriodLabel}: notified ${recipientCount} recipient(s).`,
    );

    await this.advanceNextRunAt(schedule, now);
  }

  private async claimExecution(
    schedule: {
      id: string;
      agencyId: string;
      clientId: string;
      scheduleType: ReportNotificationScheduleType;
      daysBeforeMonthEnd: number | null;
      sendTime: string;
      timezone: string;
    },
    reportYear: number,
    reportMonth: number,
    reportPeriodLabel: string,
    now: Date,
  ): Promise<string | null> {
    try {
      const execution =
        await this.prisma.clientReportNotificationExecution.create({
          data: {
            scheduleId: schedule.id,
            agencyId: schedule.agencyId,
            clientId: schedule.clientId,
            reportYear,
            reportMonth,
            scheduledAt: now,
            status: ReportNotificationExecutionStatus.PENDING,
            attemptCount: 1,
            lastAttemptAt: now,
          },
        });

      return execution.id;
    } catch (err: any) {
      if (err?.code !== "P2002") {
        throw err;
      }
    }

    const existingExecution =
      await this.prisma.clientReportNotificationExecution.findUnique({
        where: {
          scheduleId_reportYear_reportMonth: {
            scheduleId: schedule.id,
            reportYear,
            reportMonth,
          },
        },
      });

    if (!existingExecution) {
      this.logger.debug(
        `Schedule ${schedule.id} period ${reportPeriodLabel} hit a unique conflict but no execution was visible.`,
      );
      return null;
    }

    if (
      existingExecution.status === ReportNotificationExecutionStatus.SENT ||
      existingExecution.status ===
        ReportNotificationExecutionStatus.SKIPPED_NO_REPORTS
    ) {
      this.logger.log(
        `Execution for schedule ${schedule.id} period ${reportPeriodLabel} is already ${existingExecution.status}.`,
      );
      await this.advanceNextRunAt(schedule, now);
      return null;
    }

    if (
      existingExecution.status === ReportNotificationExecutionStatus.PENDING
    ) {
      this.logger.debug(
        `Schedule ${schedule.id} period ${reportPeriodLabel} is already owned by another worker.`,
      );
      return null;
    }

    if (existingExecution.attemptCount >= MAX_ATTEMPTS) {
      this.logger.warn(
        `Execution for schedule ${schedule.id} period ${reportPeriodLabel} exhausted ${MAX_ATTEMPTS} attempts.`,
      );
      await this.advanceNextRunAt(schedule, now);
      return null;
    }

    const claimed =
      await this.prisma.clientReportNotificationExecution.updateMany({
        where: {
          id: existingExecution.id,
          status: ReportNotificationExecutionStatus.FAILED,
          attemptCount: { lt: MAX_ATTEMPTS },
        },
        data: {
          status: ReportNotificationExecutionStatus.PENDING,
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          errorDetails: null,
          updatedAt: now,
        },
      });

    if (claimed.count === 0) {
      this.logger.debug(
        `Schedule ${schedule.id} period ${reportPeriodLabel} failed retry claim; another worker owns it.`,
      );
      return null;
    }

    return existingExecution.id;
  }

  /**
   * Advance nextRunAt and record lastRunAt after a completed execution (any terminal state).
   */
  private async advanceNextRunAt(
    schedule: {
      id: string;
      agencyId: string;
      clientId: string;
      scheduleType: ReportNotificationScheduleType;
      daysBeforeMonthEnd: number | null;
      sendTime: string;
      timezone: string;
    },
    now: Date,
  ): Promise<void> {
    try {
      const nextRunAt = this.scheduleCalculator.calculateNextRunAt({
        scheduleType: schedule.scheduleType,
        daysBeforeMonthEnd: schedule.daysBeforeMonthEnd ?? undefined,
        sendTime: schedule.sendTime,
        timezone: schedule.timezone,
        fromDate: now,
      });

      await this.prisma.clientReportNotificationSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          version: { increment: 1 },
        },
      });

      this.logger.log(
        `Schedule ${schedule.id}: nextRunAt advanced to ${nextRunAt.toISOString()}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to advance nextRunAt for schedule ${schedule.id}`,
        err,
      );
    }
  }
}
