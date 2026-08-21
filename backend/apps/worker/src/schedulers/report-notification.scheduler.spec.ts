import { ConfigService } from "@nestjs/config";
import {
  ReportNotificationExecutionStatus,
  ReportNotificationScheduleType,
} from "@prisma/client";
import { ReportNotificationSchedulerService } from "./report-notification.scheduler";

describe("ReportNotificationSchedulerService execution claiming", () => {
  const now = new Date("2026-08-31T12:30:00.000Z");
  const schedule = {
    id: "schedule_1",
    agencyId: "agency_1",
    clientId: "client_1",
    scheduleType: ReportNotificationScheduleType.LAST_WORKING_DAY,
    daysBeforeMonthEnd: null,
    sendTime: "18:00",
    timezone: "Asia/Kolkata",
  };

  let prisma: any;
  let scheduler: ReportNotificationSchedulerService;

  beforeEach(() => {
    prisma = {
      clientReportNotificationExecution: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      clientReportNotificationSchedule: {
        update: jest.fn(),
      },
    };

    const scheduleCalculator = {
      calculateNextRunAt: jest.fn(() => new Date("2026-09-30T12:30:00.000Z")),
    };

    scheduler = new ReportNotificationSchedulerService(
      prisma,
      {} as any,
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
        status: ReportNotificationExecutionStatus.PENDING,
        attemptCount: 1,
        lastAttemptAt: now,
      }),
    });
    expect(
      prisma.clientReportNotificationExecution.findUnique,
    ).not.toHaveBeenCalled();
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
      "August 2026",
      now,
    );

    expect(executionId).toBeNull();
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
});
