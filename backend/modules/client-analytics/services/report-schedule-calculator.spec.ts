import {
  ReportNotificationFrequency,
  ReportNotificationScheduleType,
  ReportNotificationWeekday,
} from "@prisma/client";
import { ReportScheduleCalculatorService } from "./report-schedule-calculator.service";

describe("ReportScheduleCalculatorService", () => {
  let service: ReportScheduleCalculatorService;

  beforeEach(() => {
    service = new ReportScheduleCalculatorService();
  });

  describe("Calendar Day Calculation", () => {
    describe("FIRST_DAY", () => {
      it("always returns day 1", () => {
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.FIRST_DAY,
          ),
        ).toBe(1);
        expect(
          service.calculateTargetDayInMonth(
            2028,
            2,
            ReportNotificationScheduleType.FIRST_DAY,
          ),
        ).toBe(1);
      });
    });

    describe("FIRST_WORKING_DAY", () => {
      it("returns day 1 if month starts on a weekday (e.g. Wednesday July 1, 2026)", () => {
        // 2026-07-01 is Wednesday
        expect(
          service.calculateTargetDayInMonth(
            2026,
            7,
            ReportNotificationScheduleType.FIRST_WORKING_DAY,
          ),
        ).toBe(1);
      });

      it("returns day 3 (Monday) if month starts on a Saturday (e.g. August 1, 2026)", () => {
        // 2026-08-01 is Saturday
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.FIRST_WORKING_DAY,
          ),
        ).toBe(3);
      });

      it("returns day 2 (Monday) if month starts on a Sunday (e.g. November 1, 2026)", () => {
        // 2026-11-01 is Sunday
        expect(
          service.calculateTargetDayInMonth(
            2026,
            11,
            ReportNotificationScheduleType.FIRST_WORKING_DAY,
          ),
        ).toBe(2);
      });
    });

    describe("LAST_DAY", () => {
      it("returns 28 for non-leap February (2027)", () => {
        expect(
          service.calculateTargetDayInMonth(
            2027,
            2,
            ReportNotificationScheduleType.LAST_DAY,
          ),
        ).toBe(28);
      });

      it("returns 29 for leap year February (2028)", () => {
        expect(
          service.calculateTargetDayInMonth(
            2028,
            2,
            ReportNotificationScheduleType.LAST_DAY,
          ),
        ).toBe(29);
      });

      it("returns 30 for April, June, Sept, Nov", () => {
        expect(
          service.calculateTargetDayInMonth(
            2026,
            4,
            ReportNotificationScheduleType.LAST_DAY,
          ),
        ).toBe(30);
        expect(
          service.calculateTargetDayInMonth(
            2026,
            9,
            ReportNotificationScheduleType.LAST_DAY,
          ),
        ).toBe(30);
      });

      it("returns 31 for January, March, May, July, August, October, December", () => {
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.LAST_DAY,
          ),
        ).toBe(31);
        expect(
          service.calculateTargetDayInMonth(
            2026,
            12,
            ReportNotificationScheduleType.LAST_DAY,
          ),
        ).toBe(31);
      });
    });

    describe("LAST_WORKING_DAY", () => {
      it("returns the last calendar day if it is a weekday (e.g. Monday August 31, 2026)", () => {
        // 2026-08-31 is Monday
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.LAST_WORKING_DAY,
          ),
        ).toBe(31);
      });

      it("returns Friday (day 30) if month ends on Saturday (e.g. October 31, 2026)", () => {
        // 2026-10-31 is Saturday
        expect(
          service.calculateTargetDayInMonth(
            2026,
            10,
            ReportNotificationScheduleType.LAST_WORKING_DAY,
          ),
        ).toBe(30);
      });

      it("returns Friday (day 29) if month ends on Sunday (e.g. May 31, 2026)", () => {
        // 2026-05-31 is Sunday
        expect(
          service.calculateTargetDayInMonth(
            2026,
            5,
            ReportNotificationScheduleType.LAST_WORKING_DAY,
          ),
        ).toBe(29);
      });
    });

    describe("DAYS_BEFORE_MONTH_END", () => {
      it("calculates exact offsets from month end (1, 2, 3, 5, 7 days)", () => {
        // August has 31 days
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END,
            1,
          ),
        ).toBe(30);
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END,
            3,
          ),
        ).toBe(28);
        expect(
          service.calculateTargetDayInMonth(
            2026,
            8,
            ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END,
            7,
          ),
        ).toBe(24);

        // February 2028 (29 days)
        expect(
          service.calculateTargetDayInMonth(
            2028,
            2,
            ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END,
            2,
          ),
        ).toBe(27);

        // February 2027 (28 days)
        expect(
          service.calculateTargetDayInMonth(
            2027,
            2,
            ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END,
            5,
          ),
        ).toBe(23);
      });
    });
  });

  describe("Reporting Period Resolution", () => {
    it("FIRST_DAY and FIRST_WORKING_DAY refer to the previous calendar month", () => {
      const runDate = new Date("2026-09-01T04:30:00.000Z"); // 10:00 AM IST
      const period1 = service.resolveReportPeriod(
        ReportNotificationScheduleType.FIRST_DAY,
        runDate,
        "Asia/Kolkata",
      );
      expect(period1.reportYear).toBe(2026);
      expect(period1.reportMonth).toBe(8);
      expect(period1.label).toBe("August 2026");

      const period2 = service.resolveReportPeriod(
        ReportNotificationScheduleType.FIRST_WORKING_DAY,
        runDate,
        "Asia/Kolkata",
      );
      expect(period2.reportYear).toBe(2026);
      expect(period2.reportMonth).toBe(8);
    });

    it("FIRST_DAY in January refers to December of previous year", () => {
      const runDate = new Date("2027-01-01T04:30:00.000Z");
      const period = service.resolveReportPeriod(
        ReportNotificationScheduleType.FIRST_DAY,
        runDate,
        "Asia/Kolkata",
      );
      expect(period.reportYear).toBe(2026);
      expect(period.reportMonth).toBe(12);
      expect(period.label).toBe("December 2026");
    });

    it("LAST_DAY, LAST_WORKING_DAY, and DAYS_BEFORE_MONTH_END refer to the current calendar month", () => {
      const runDate = new Date("2026-08-31T04:30:00.000Z");
      const period = service.resolveReportPeriod(
        ReportNotificationScheduleType.LAST_WORKING_DAY,
        runDate,
        "Asia/Kolkata",
      );
      expect(period.reportYear).toBe(2026);
      expect(period.reportMonth).toBe(8);
      expect(period.label).toBe("August 2026");
    });
  });

  describe("calculateNextRunAt", () => {
    it("returns the target date in the current month if in future", () => {
      const fromDate = new Date("2026-08-15T00:00:00.000Z");
      const nextRun = service.calculateNextRunAt({
        scheduleType: ReportNotificationScheduleType.LAST_WORKING_DAY,
        sendTime: "10:00",
        timezone: "Asia/Kolkata",
        fromDate,
      });

      // August 31, 2026 10:00 AM IST = 2026-08-31T04:30:00.000Z
      expect(nextRun.toISOString()).toBe("2026-08-31T04:30:00.000Z");
    });

    it("advances to next month if target date in current month has passed", () => {
      // Current date is Aug 31 at 12:00 PM IST (past 10:00 AM)
      const fromDate = new Date("2026-08-31T06:30:00.000Z");
      const nextRun = service.calculateNextRunAt({
        scheduleType: ReportNotificationScheduleType.LAST_WORKING_DAY,
        sendTime: "10:00",
        timezone: "Asia/Kolkata",
        fromDate,
      });

      // September 30, 2026 is Wednesday -> 10:00 AM IST = 2026-09-30T04:30:00.000Z
      expect(nextRun.toISOString()).toBe("2026-09-30T04:30:00.000Z");
    });

    it("correctly rolls over December to January", () => {
      const fromDate = new Date("2026-12-31T18:00:00.000Z");
      const nextRun = service.calculateNextRunAt({
        scheduleType: ReportNotificationScheduleType.FIRST_DAY,
        sendTime: "09:00",
        timezone: "UTC",
        fromDate,
      });

      // January 1, 2027 at 09:00 UTC
      expect(nextRun.toISOString()).toBe("2027-01-01T09:00:00.000Z");
    });

    it("accurately handles timezone offset (e.g. America/New_York EDT = UTC-4)", () => {
      const fromDate = new Date("2026-08-01T00:00:00.000Z");
      const nextRun = service.calculateNextRunAt({
        scheduleType: ReportNotificationScheduleType.LAST_DAY,
        sendTime: "10:00",
        timezone: "America/New_York",
        fromDate,
      });

      // Aug 31, 2026 at 10:00 AM EDT (UTC-4) = 2026-08-31T14:00:00.000Z
      expect(nextRun.toISOString()).toBe("2026-08-31T14:00:00.000Z");
    });
  });

  describe("weekly scheduling", () => {
    it("supports each weekday selection", () => {
      const fromDate = new Date("2026-08-17T00:00:00.000Z"); // Monday
      const expected: Record<ReportNotificationWeekday, string> = {
        MONDAY: "2026-08-17T04:30:00.000Z",
        TUESDAY: "2026-08-18T04:30:00.000Z",
        WEDNESDAY: "2026-08-19T04:30:00.000Z",
        THURSDAY: "2026-08-20T04:30:00.000Z",
        FRIDAY: "2026-08-21T04:30:00.000Z",
        SATURDAY: "2026-08-22T04:30:00.000Z",
        SUNDAY: "2026-08-23T04:30:00.000Z",
      };

      for (const day of Object.values(ReportNotificationWeekday)) {
        expect(
          service
            .calculateNextRunAt({
              frequency: ReportNotificationFrequency.WEEKLY,
              weeklyDay: day,
              sendTime: "10:00",
              timezone: "Asia/Kolkata",
              fromDate,
            })
            .toISOString(),
        ).toBe(expected[day]);
      }
    });

    it("uses same-day weekly run if scheduled time has not passed", () => {
      const nextRun = service.calculateNextRunAt({
        frequency: ReportNotificationFrequency.WEEKLY,
        weeklyDay: ReportNotificationWeekday.SATURDAY,
        sendTime: "18:00",
        timezone: "Asia/Kolkata",
        fromDate: new Date("2026-08-22T11:00:00.000Z"), // 4:30 PM IST
      });

      expect(nextRun.toISOString()).toBe("2026-08-22T12:30:00.000Z");
    });

    it("advances weekly run by one week if same-day time has passed", () => {
      const nextRun = service.calculateNextRunAt({
        frequency: ReportNotificationFrequency.WEEKLY,
        weeklyDay: ReportNotificationWeekday.SATURDAY,
        sendTime: "18:00",
        timezone: "Asia/Kolkata",
        fromDate: new Date("2026-08-22T13:00:00.000Z"), // 6:30 PM IST
      });

      expect(nextRun.toISOString()).toBe("2026-08-29T12:30:00.000Z");
    });

    it("resolves Monday-Sunday weekly period across month boundaries", () => {
      const period = service.resolveReportingPeriod({
        frequency: ReportNotificationFrequency.WEEKLY,
        weeklyDay: ReportNotificationWeekday.FRIDAY,
        runDate: new Date("2026-09-04T04:30:00.000Z"),
        timezone: "Asia/Kolkata",
      });

      expect(period.label).toBe("August 31 - September 6, 2026");
      expect(period.periodStart.toISOString()).toBe("2026-08-30T18:30:00.000Z");
      expect(period.periodEnd.toISOString()).toBe("2026-09-06T18:29:59.999Z");
      expect(period.reportYear).toBe(2026);
      expect(period.reportMonth).toBe(8);
    });

    it("resolves weekly period across year boundaries", () => {
      const period = service.resolveReportingPeriod({
        frequency: ReportNotificationFrequency.WEEKLY,
        weeklyDay: ReportNotificationWeekday.FRIDAY,
        runDate: new Date("2026-01-02T10:00:00.000Z"),
        timezone: "UTC",
      });

      expect(period.label).toBe("December 29, 2025 - January 4, 2026");
      expect(period.periodStart.toISOString()).toBe("2025-12-29T00:00:00.000Z");
      expect(period.periodEnd.toISOString()).toBe("2026-01-04T23:59:59.999Z");
    });

    it("stores weekly timestamps in UTC for non-Indian timezones", () => {
      const nextRun = service.calculateNextRunAt({
        frequency: ReportNotificationFrequency.WEEKLY,
        weeklyDay: ReportNotificationWeekday.FRIDAY,
        sendTime: "10:00",
        timezone: "America/New_York",
        fromDate: new Date("2026-08-21T12:00:00.000Z"),
      });

      expect(nextRun.toISOString()).toBe("2026-08-21T14:00:00.000Z");
    });

    it("handles DST offsets when resolving weekly period boundaries", () => {
      const period = service.resolveReportingPeriod({
        frequency: ReportNotificationFrequency.WEEKLY,
        weeklyDay: ReportNotificationWeekday.FRIDAY,
        runDate: new Date("2026-03-13T14:00:00.000Z"),
        timezone: "America/New_York",
      });

      expect(period.periodStart.toISOString()).toBe("2026-03-09T04:00:00.000Z");
      expect(period.periodEnd.toISOString()).toBe("2026-03-16T03:59:59.999Z");
    });
  });

  describe("Validation", () => {
    it("rejects invalid daysBeforeMonthEnd", () => {
      expect(() =>
        service.validateScheduleInput(
          ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END,
          4, // Not in [1, 2, 3, 5, 7]
          "10:00",
        ),
      ).toThrow();
    });

    it("rejects invalid sendTime format", () => {
      expect(() =>
        service.validateScheduleInput(
          ReportNotificationScheduleType.LAST_DAY,
          null,
          "25:00",
        ),
      ).toThrow();
      expect(() =>
        service.validateScheduleInput(
          ReportNotificationScheduleType.LAST_DAY,
          null,
          "10:65",
        ),
      ).toThrow();
      expect(() =>
        service.validateScheduleInput(
          ReportNotificationScheduleType.LAST_DAY,
          null,
          "10am",
        ),
      ).toThrow();
    });

    it("rejects invalid timezone", () => {
      expect(() =>
        service.validateScheduleInput(
          ReportNotificationScheduleType.LAST_DAY,
          null,
          "10:00",
          "Mars/Olympus_Mons",
        ),
      ).toThrow();
    });
  });
});
