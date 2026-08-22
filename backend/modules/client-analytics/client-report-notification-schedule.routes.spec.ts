import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClientAnalyticsService } from "./client-analytics.service";
import { ClientReportNotificationScheduleController } from "./client-analytics.controller";

describe("Client report notification schedule HTTP routes", () => {
  let app: INestApplication;
  let baseUrl: string;
  const service = {
    getReportNotificationSchedule: jest.fn(),
    upsertReportNotificationSchedule: jest.fn(),
    previewReportNotificationSchedule: jest.fn(),
    sendReportNotificationTestEmail: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientReportNotificationScheduleController],
      providers: [{ provide: ClientAnalyticsService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") {
      throw new Error("Expected HTTP server to bind to an ephemeral port.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.previewReportNotificationSchedule.mockResolvedValue({
      frequency: "WEEKLY",
      weeklyDay: "SATURDAY",
      sendTime: "12:45",
      timezone: "Asia/Kolkata",
      nextRunAt: new Date("2026-08-22T07:15:00.000Z"),
      reportPeriodLabel: "August 17-23, 2026",
    });
  });

  async function postPreview(body: Record<string, unknown>) {
    const response = await fetch(
      `${baseUrl}/api/v1/clients/client_1/report-notification-schedule/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = await response.json();
    return { response, payload };
  }

  it("registers the canonical preview route and accepts WEEKLY + SATURDAY", async () => {
    const { response, payload } = await postPreview({
      frequency: "WEEKLY",
      weeklyDay: "SATURDAY",
      sendTime: "12:45",
      timezone: "Asia/Kolkata",
      enabled: true,
    });

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      frequency: "WEEKLY",
      weeklyDay: "SATURDAY",
    });
    expect(service.previewReportNotificationSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: "WEEKLY",
        weeklyDay: "SATURDAY",
        sendTime: "12:45",
        timezone: "Asia/Kolkata",
      }),
    );
  });

  it("accepts MONTHLY + LAST_WORKING_DAY on the canonical preview route", async () => {
    service.previewReportNotificationSchedule.mockResolvedValueOnce({
      frequency: "MONTHLY",
      scheduleType: "LAST_WORKING_DAY",
      sendTime: "12:45",
      timezone: "Asia/Kolkata",
      nextRunAt: new Date("2026-08-31T07:15:00.000Z"),
      reportPeriodLabel: "August 2026",
    });

    const { response, payload } = await postPreview({
      frequency: "MONTHLY",
      scheduleType: "LAST_WORKING_DAY",
      sendTime: "12:45",
      timezone: "Asia/Kolkata",
    });

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      frequency: "MONTHLY",
      scheduleType: "LAST_WORKING_DAY",
    });
  });

  it("rejects extraneous fields on the canonical preview route", async () => {
    const { response, payload } = await postPreview({
      frequency: "WEEKLY",
      weeklyDay: "SATURDAY",
      sendTime: "12:45",
      timezone: "Asia/Kolkata",
      unsupported: true,
    });

    expect(response.status).toBe(400);
    expect(payload.message).toEqual(
      expect.arrayContaining(["property unsupported should not exist"]),
    );
  });
});
