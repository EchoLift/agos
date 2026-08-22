import { ClientReportNotificationScheduleController } from "./client-analytics.controller";

describe("ClientReportNotificationScheduleController", () => {
  const actor = {
    authUserId: "auth_1",
    userId: "user_1",
    sessionId: "session_1",
    agencyId: "agency_1",
    permissions: ["CLIENT_UPDATE"],
  };

  let service: any;
  let controller: ClientReportNotificationScheduleController;

  beforeEach(() => {
    service = {
      getReportNotificationSchedule: jest.fn(),
      upsertReportNotificationSchedule: jest.fn(),
      previewReportNotificationSchedule: jest.fn(),
    };
    controller = new ClientReportNotificationScheduleController(service);
  });

  it("uses the canonical weekly DTO payload for preview", async () => {
    const dto = {
      frequency: "WEEKLY" as any,
      weeklyDay: "SATURDAY" as any,
      sendTime: "10:00",
      timezone: "Asia/Kolkata",
    };
    service.previewReportNotificationSchedule.mockResolvedValue({
      frequency: "WEEKLY",
    });

    await controller.previewReportNotificationSchedule("client_1", dto);

    expect(service.previewReportNotificationSchedule).toHaveBeenCalledWith(dto);
  });

  it("uses the canonical weekly DTO payload for save", async () => {
    const dto = {
      frequency: "WEEKLY" as any,
      weeklyDay: "SATURDAY" as any,
      sendTime: "10:00",
      timezone: "Asia/Kolkata",
      enabled: true,
    };
    service.upsertReportNotificationSchedule.mockResolvedValue({
      frequency: "WEEKLY",
    });

    await controller.upsertReportNotificationSchedule("client_1", dto, actor);

    expect(service.upsertReportNotificationSchedule).toHaveBeenCalledWith(
      "client_1",
      dto,
      actor,
    );
  });
});
