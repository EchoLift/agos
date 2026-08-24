import { ConfigService } from "@nestjs/config";
import {
  ReportNotificationExecutionStatus,
  ReportNotificationFrequency,
  ReportNotificationScheduleType,
  ReportNotificationWeekday,
} from "@prisma/client";
import { ReportNotificationSchedulerService } from "./report-notification.scheduler";

describe("ReportNotificationSchedulerService execution claiming", () => {
  const now = new Date("2026-08-31T12:30:00.000Z");
  const schedule = {
    id: "schedule_1",
    agencyId: "agency_1",
    clientId: "client_1",
    frequency: ReportNotificationFrequency.MONTHLY,
    scheduleType: ReportNotificationScheduleType.LAST_WORKING_DAY,
    weeklyDay: null,
    daysBeforeMonthEnd: null,
    sendTime: "18:00",
    timezone: "Asia/Kolkata",
  };
  const periodStart = new Date("2026-08-01T00:00:00.000Z");
  const periodEnd = new Date("2026-08-31T23:59:59.999Z");

  let prisma: any;
  let notificationService: any;
  let scheduleCalculator: any;
  let scheduler: ReportNotificationSchedulerService;

  beforeEach(() => {
    prisma = {
      clientReportNotificationExecution: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      clientReportNotificationSchedule: {
        update: jest.fn(),
      },
      clientAnalyticsAsset: {
        count: jest.fn(),
      },
      client: {
        findFirst: jest.fn(),
      },
    };

    notificationService = {
      notify: jest.fn(),
    };

    scheduleCalculator = {
      calculateNextRunAt: jest.fn(() => new Date("2026-09-30T12:30:00.000Z")),
      resolveReportingPeriod: jest.fn(() => ({
        reportYear: 2026,
        reportMonth: 8,
        periodStart,
        periodEnd,
        label: "August 2026",
      })),
      getLocalYearMonth: jest.fn((date: Date) => ({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
      })),
    };

    scheduler = new ReportNotificationSchedulerService(
      prisma,
      notificationService,
      scheduleCalculator as any,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it("claims a fresh execution by inserting PENDING before any read", async () => {
    prisma.clientReportNotificationExecution.create.mockResolvedValue({
      id: "execution_1",
    });

    const executionId = await (scheduler as any).claimExecution(
      schedule,
      2026,
      8,
      periodStart,
      periodEnd,
      "August 2026",
      now,
    );

    expect(executionId).toBe("execution_1");
    expect(
      prisma.clientReportNotificationExecution.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduleId: "schedule_1",
        reportYear: 2026,
        reportMonth: 8,
        periodStart,
        periodEnd,
        status: ReportNotificationExecutionStatus.PENDING,
        attemptCount: 1,
        lastAttemptAt: now,
      }),
    });
    expect(
      prisma.clientReportNotificationExecution.findUnique,
    ).not.toHaveBeenCalled();
  });

  it("allows multiple weekly executions in the same calendar month when periods differ", async () => {
    const weeklySchedule = {
      ...schedule,
      frequency: ReportNotificationFrequency.WEEKLY,
      weeklyDay: ReportNotificationWeekday.SATURDAY,
    };
    prisma.clientReportNotificationExecution.create
      .mockResolvedValueOnce({ id: "execution_week_1" })
      .mockResolvedValueOnce({ id: "execution_week_2" });

    const first = await (scheduler as any).claimExecution(
      weeklySchedule,
      2026,
      8,
      new Date("2026-08-16T18:30:00.000Z"),
      new Date("2026-08-23T18:29:59.999Z"),
      "August 17-23, 2026",
      now,
    );
    const second = await (scheduler as any).claimExecution(
      weeklySchedule,
      2026,
      8,
      new Date("2026-08-23T18:30:00.000Z"),
      new Date("2026-08-30T18:29:59.999Z"),
      "August 24-30, 2026",
      now,
    );

    expect(first).toBe("execution_week_1");
    expect(second).toBe("execution_week_2");
    expect(
      prisma.clientReportNotificationExecution.create,
    ).toHaveBeenCalledTimes(2);
  });

  it("does not reuse an existing PENDING execution owned by another worker", async () => {
    prisma.clientReportNotificationExecution.create.mockRejectedValue({
      code: "P2002",
    });
    prisma.clientReportNotificationExecution.findUnique.mockResolvedValue({
      id: "execution_1",
      status: ReportNotificationExecutionStatus.PENDING,
      attemptCount: 1,
    });

    const executionId = await (scheduler as any).claimExecution(
      schedule,
      2026,
      8,
      periodStart,
      periodEnd,
      "August 2026",
      now,
    );

    expect(executionId).toBeNull();
    expect(
      prisma.clientReportNotificationExecution.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        scheduleId_periodStart_periodEnd: {
          scheduleId: "schedule_1",
          periodStart,
          periodEnd,
        },
      },
    });
    expect(
      prisma.clientReportNotificationExecution.updateMany,
    ).not.toHaveBeenCalled();
  });

  it("retries a FAILED execution by atomically moving it back to PENDING", async () => {
    prisma.clientReportNotificationExecution.create.mockRejectedValue({
      code: "P2002",
    });
    prisma.clientReportNotificationExecution.findUnique.mockResolvedValue({
      id: "execution_1",
      status: ReportNotificationExecutionStatus.FAILED,
      attemptCount: 1,
    });
    prisma.clientReportNotificationExecution.updateMany.mockResolvedValue({
      count: 1,
    });

    const executionId = await (scheduler as any).claimExecution(
      schedule,
      2026,
      8,
      periodStart,
      periodEnd,
      "August 2026",
      now,
    );

    expect(executionId).toBe("execution_1");
    expect(
      prisma.clientReportNotificationExecution.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: "execution_1",
        status: ReportNotificationExecutionStatus.FAILED,
        attemptCount: { lt: 3 },
      },
      data: expect.objectContaining({
        status: ReportNotificationExecutionStatus.PENDING,
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        errorDetails: null,
      }),
    });
  });

  it("sends scheduled report notifications only to the client primary contact", async () => {
    prisma.clientReportNotificationExecution.create.mockResolvedValue({
      id: "execution_1",
    });
    prisma.clientAnalyticsAsset.count.mockResolvedValue(1);
    prisma.client.findFirst.mockResolvedValue({
      id: "client_1",
      primaryContactUser: {
        id: "user-primary",
        name: "Mani",
        authUser: { id: "auth-primary" },
      },
    });

    await (scheduler as any).processOneSchedule(
      {
        ...schedule,
        agency: { id: "agency_1", name: "AGENCIE", slug: "agency-one" },
        client: { id: "client_1", name: "50-BraIns", timezone: null },
      },
      now,
    );

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: {
        id: "client_1",
        agencyId: "agency_1",
        deletedAt: null,
      },
      include: {
        primaryContactUser: {
          include: { authUser: true },
        },
      },
    });
    expect(notificationService.notify).toHaveBeenCalledTimes(1);
    expect(notificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "agency_1",
        userId: "user-primary",
        eventType: "ClientReportReady",
        recipientType: "CLIENT",
      }),
    );
    expect(
      prisma.clientReportNotificationExecution.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "execution_1" },
        data: expect.objectContaining({
          status: ReportNotificationExecutionStatus.SENT,
          recipientCount: 1,
        }),
      }),
    );
  });
});
