import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import {
  PreviewReportNotificationScheduleDto,
  UpsertReportNotificationScheduleDto,
} from "./report-notification-schedule.dto";

describe("Report notification schedule DTO validation", () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validate = (value: Record<string, unknown>, metatype: Function) =>
    pipe.transform(value, {
      type: "body",
      metatype,
      data: "",
    } as ArgumentMetadata);

  it("accepts MONTHLY + LAST_WORKING_DAY for preview", async () => {
    await expect(
      validate(
        {
          frequency: "MONTHLY",
          scheduleType: "LAST_WORKING_DAY",
          sendTime: "10:00",
          timezone: "Asia/Kolkata",
        },
        PreviewReportNotificationScheduleDto,
      ),
    ).resolves.toMatchObject({
      frequency: "MONTHLY",
      scheduleType: "LAST_WORKING_DAY",
    });
  });

  it("accepts MONTHLY + LAST_WORKING_DAY for save", async () => {
    await expect(
      validate(
        {
          frequency: "MONTHLY",
          scheduleType: "LAST_WORKING_DAY",
          sendTime: "10:00",
          timezone: "Asia/Kolkata",
          enabled: true,
        },
        UpsertReportNotificationScheduleDto,
      ),
    ).resolves.toMatchObject({
      frequency: "MONTHLY",
      scheduleType: "LAST_WORKING_DAY",
      enabled: true,
    });
  });

  it("accepts WEEKLY + SATURDAY for preview", async () => {
    await expect(
      validate(
        {
          frequency: "WEEKLY",
          weeklyDay: "SATURDAY",
          sendTime: "10:00",
          timezone: "Asia/Kolkata",
        },
        PreviewReportNotificationScheduleDto,
      ),
    ).resolves.toMatchObject({
      frequency: "WEEKLY",
      weeklyDay: "SATURDAY",
    });
  });

  it("accepts WEEKLY + SATURDAY for save", async () => {
    await expect(
      validate(
        {
          frequency: "WEEKLY",
          weeklyDay: "SATURDAY",
          sendTime: "10:00",
          timezone: "Asia/Kolkata",
          enabled: true,
        },
        UpsertReportNotificationScheduleDto,
      ),
    ).resolves.toMatchObject({
      frequency: "WEEKLY",
      weeklyDay: "SATURDAY",
      enabled: true,
    });
  });

  it("rejects legacy/extraneous fields", async () => {
    try {
      await validate(
        {
          frequency: "WEEKLY",
          weeklyDay: "SATURDAY",
          sendTime: "10:00",
          timezone: "Asia/Kolkata",
          unknownField: true,
        },
        PreviewReportNotificationScheduleDto,
      );
      throw new Error("Expected validation to reject unknownField");
    } catch (error: any) {
      expect(error.getResponse()).toMatchObject({
        message: expect.arrayContaining([
          "property unknownField should not exist",
        ]),
      });
    }
  });
});
