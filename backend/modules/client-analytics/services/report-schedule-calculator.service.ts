import { Injectable, BadRequestException } from "@nestjs/common";
import {
  ReportNotificationFrequency,
  ReportNotificationScheduleType,
  ReportNotificationWeekday,
} from "@prisma/client";

export interface CalculateScheduleInput {
  frequency?: ReportNotificationFrequency | null;
  scheduleType?: ReportNotificationScheduleType | null;
  weeklyDay?: ReportNotificationWeekday | null;
  daysBeforeMonthEnd?: number | null;
  sendTime: string; // "HH:mm"
  timezone?: string | null;
  fromDate?: Date;
}

export interface SchedulePreviewResult {
  frequency: ReportNotificationFrequency;
  scheduleType: ReportNotificationScheduleType | null;
  weeklyDay: ReportNotificationWeekday | null;
  daysBeforeMonthEnd: number | null;
  sendTime: string;
  timezone: string;
  nextRunAt: Date;
  reportYear: number;
  reportMonth: number;
  periodStart: Date;
  periodEnd: Date;
  reportPeriodLabel: string;
}

export interface ResolvedReportPeriod {
  reportYear: number;
  reportMonth: number;
  periodStart: Date;
  periodEnd: Date;
  label: string;
}

export const ALLOWED_DAYS_BEFORE_MONTH_END = [1, 2, 3, 5, 7] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAY_LABELS: Record<ReportNotificationWeekday, string> = {
  [ReportNotificationWeekday.MONDAY]: "Monday",
  [ReportNotificationWeekday.TUESDAY]: "Tuesday",
  [ReportNotificationWeekday.WEDNESDAY]: "Wednesday",
  [ReportNotificationWeekday.THURSDAY]: "Thursday",
  [ReportNotificationWeekday.FRIDAY]: "Friday",
  [ReportNotificationWeekday.SATURDAY]: "Saturday",
  [ReportNotificationWeekday.SUNDAY]: "Sunday",
};

const WEEKDAY_TO_JS_DAY: Record<ReportNotificationWeekday, number> = {
  [ReportNotificationWeekday.SUNDAY]: 0,
  [ReportNotificationWeekday.MONDAY]: 1,
  [ReportNotificationWeekday.TUESDAY]: 2,
  [ReportNotificationWeekday.WEDNESDAY]: 3,
  [ReportNotificationWeekday.THURSDAY]: 4,
  [ReportNotificationWeekday.FRIDAY]: 5,
  [ReportNotificationWeekday.SATURDAY]: 6,
};

@Injectable()
export class ReportScheduleCalculatorService {
  /**
   * Validate schedule input parameters.
   */
  validateScheduleInput(
    scheduleType: ReportNotificationScheduleType,
    daysBeforeMonthEnd?: number | null,
    sendTime?: string,
    timezone?: string | null,
  ): void {
    if (!scheduleType) {
      throw new BadRequestException("Schedule type is required.");
    }

    if (scheduleType === ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END) {
      if (
        !daysBeforeMonthEnd ||
        !ALLOWED_DAYS_BEFORE_MONTH_END.includes(
          daysBeforeMonthEnd as (typeof ALLOWED_DAYS_BEFORE_MONTH_END)[number],
        )
      ) {
        throw new BadRequestException(
          `daysBeforeMonthEnd must be one of: ${ALLOWED_DAYS_BEFORE_MONTH_END.join(", ")}.`,
        );
      }
    }

    if (sendTime) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime);
      if (!match) {
        throw new BadRequestException(
          "sendTime must be in 24-hour HH:mm format (e.g. 10:00).",
        );
      }
    }

    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        throw new BadRequestException(`Invalid IANA timezone: ${timezone}`);
      }
    }
  }

  validateScheduleConfig(input: CalculateScheduleInput): void {
    const frequency = input.frequency ?? ReportNotificationFrequency.MONTHLY;

    if (frequency === ReportNotificationFrequency.MONTHLY) {
      if (!input.scheduleType) {
        throw new BadRequestException("Schedule type is required.");
      }
      this.validateScheduleInput(
        input.scheduleType,
        input.daysBeforeMonthEnd,
        input.sendTime,
        input.timezone,
      );
      return;
    }

    if (!input.weeklyDay) {
      throw new BadRequestException("Weekly notification day is required.");
    }

    if (!Object.values(ReportNotificationWeekday).includes(input.weeklyDay)) {
      throw new BadRequestException("Invalid weekly notification day.");
    }

    if (input.sendTime) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.test(input.sendTime);
      if (!match) {
        throw new BadRequestException(
          "sendTime must be in 24-hour HH:mm format (e.g. 10:00).",
        );
      }
    }

    if (input.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: input.timezone });
      } catch {
        throw new BadRequestException(`Invalid IANA timezone: ${input.timezone}`);
      }
    }
  }

  /**
   * Resolve a safe timezone (fallback to Asia/Kolkata).
   */
  normalizeTimezone(tz?: string | null): string {
    const fallback = "Asia/Kolkata";
    if (!tz) return fallback;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    } catch {
      return fallback;
    }
  }

  /**
   * Parse "HH:mm" into hours and minutes.
   */
  parseSendTime(sendTime: string): { hours: number; minutes: number } {
    const parts = sendTime.split(":");
    return {
      hours: parseInt(parts[0] || "10", 10),
      minutes: parseInt(parts[1] || "0", 10),
    };
  }

  /**
   * Number of days in a given calendar month (1-indexed month: 1=Jan, 12=Dec).
   */
  getDaysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  /**
   * Day of week (0=Sun, 1=Mon, ..., 6=Sat) for a given UTC calendar date.
   */
  getDayOfWeek(year: number, month: number, day: number): number {
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  /**
   * Calculate the 1-based day of month for a given schedule type in a specific year and month.
   */
  calculateTargetDayInMonth(
    year: number,
    month: number,
    scheduleType: ReportNotificationScheduleType,
    daysBeforeMonthEnd?: number | null,
  ): number {
    const totalDays = this.getDaysInMonth(year, month);

    switch (scheduleType) {
      case ReportNotificationScheduleType.FIRST_DAY:
        return 1;

      case ReportNotificationScheduleType.FIRST_WORKING_DAY: {
        const dow = this.getDayOfWeek(year, month, 1);
        if (dow === 6) return 3; // Saturday -> Monday
        if (dow === 0) return 2; // Sunday -> Monday
        return 1;
      }

      case ReportNotificationScheduleType.LAST_DAY:
        return totalDays;

      case ReportNotificationScheduleType.LAST_WORKING_DAY: {
        const lastDow = this.getDayOfWeek(year, month, totalDays);
        if (lastDow === 6) return totalDays - 1; // Saturday -> Friday
        if (lastDow === 0) return totalDays - 2; // Sunday -> Friday
        return totalDays;
      }

      case ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END: {
        const offset = daysBeforeMonthEnd ?? 1;
        const target = totalDays - offset;
        return Math.max(1, target);
      }

      default:
        return 1;
    }
  }

  /**
   * Converts wall-clock (year, month, day, hour, minute) in target timezone to an exact UTC Date.
   */
  getUtcDateFromLocal(
    year: number,
    month: number, // 1-12
    day: number,
    hours: number,
    minutes: number,
    timezone: string,
  ): Date {
    const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    const offset = this.getTimezoneOffsetMs(guess, timezone);
    const accurate = new Date(guess.getTime() - offset);
    const offset2 = this.getTimezoneOffsetMs(accurate, timezone);
    return new Date(guess.getTime() - offset2);
  }

  private getTimezoneOffsetMs(date: Date, timezone: string): number {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

    const localYear = getPart("year");
    const localMonth = getPart("month");
    const localDay = getPart("day");
    let localHour = getPart("hour");
    if (localHour === 24) localHour = 0;
    const localMin = getPart("minute");
    const localSec = getPart("second");

    const localAsUtc = Date.UTC(
      localYear,
      localMonth - 1,
      localDay,
      localHour,
      localMin,
      localSec,
    );
    return localAsUtc - date.getTime();
  }

  /**
   * Get current local year and month in the target timezone.
   */
  getLocalYearMonth(
    date: Date,
    timezone: string,
  ): { year: number; month: number } {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
    const month = parseInt(parts.find((p) => p.type === "month")?.value || "0", 10);
    return { year, month };
  }

  getLocalDateTimeParts(
    date: Date,
    timezone: string,
  ): {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
  } {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const read = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
    let hours = read("hour");
    if (hours === 24) hours = 0;
    return {
      year: read("year"),
      month: read("month"),
      day: read("day"),
      hours,
      minutes: read("minute"),
    };
  }

  private addLocalDays(
    year: number,
    month: number,
    day: number,
    days: number,
  ): { year: number; month: number; day: number } {
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  /**
   * Calculate next run date (in UTC) for a recurring schedule.
   */
  calculateNextRunAt(input: CalculateScheduleInput): Date {
    const timezone = this.normalizeTimezone(input.timezone);
    const frequency = input.frequency ?? ReportNotificationFrequency.MONTHLY;
    this.validateScheduleConfig({ ...input, timezone });

    const fromDate = input.fromDate || new Date();
    const { hours, minutes } = this.parseSendTime(input.sendTime);

    if (frequency === ReportNotificationFrequency.WEEKLY) {
      return this.calculateWeeklyNextRunAt({
        weeklyDay: input.weeklyDay!,
        sendTime: input.sendTime,
        timezone,
        fromDate,
      });
    }

    const scheduleType = input.scheduleType!;
    let { year, month } = this.getLocalYearMonth(fromDate, timezone);

    // Try current month
    const currentMonthDay = this.calculateTargetDayInMonth(
      year,
      month,
      scheduleType,
      input.daysBeforeMonthEnd,
    );
    const currentMonthCandidate = this.getUtcDateFromLocal(
      year,
      month,
      currentMonthDay,
      hours,
      minutes,
      timezone,
    );

    if (currentMonthCandidate.getTime() > fromDate.getTime()) {
      return currentMonthCandidate;
    }

    // Otherwise advance to next month
    if (month === 12) {
      month = 1;
      year += 1;
    } else {
      month += 1;
    }

    const nextMonthDay = this.calculateTargetDayInMonth(
      year,
      month,
      scheduleType,
      input.daysBeforeMonthEnd,
    );
    return this.getUtcDateFromLocal(
      year,
      month,
      nextMonthDay,
      hours,
      minutes,
      timezone,
    );
  }

  private calculateWeeklyNextRunAt(input: {
    weeklyDay: ReportNotificationWeekday;
    sendTime: string;
    timezone: string;
    fromDate: Date;
  }): Date {
    const { hours, minutes } = this.parseSendTime(input.sendTime);
    const local = this.getLocalDateTimeParts(input.fromDate, input.timezone);
    const currentDow = this.getDayOfWeek(local.year, local.month, local.day);
    const targetDow = WEEKDAY_TO_JS_DAY[input.weeklyDay];
    const daysUntil = (targetDow - currentDow + 7) % 7;
    const targetDate = this.addLocalDays(
      local.year,
      local.month,
      local.day,
      daysUntil,
    );

    let candidate = this.getUtcDateFromLocal(
      targetDate.year,
      targetDate.month,
      targetDate.day,
      hours,
      minutes,
      input.timezone,
    );

    if (candidate.getTime() <= input.fromDate.getTime()) {
      const nextWeek = this.addLocalDays(
        targetDate.year,
        targetDate.month,
        targetDate.day,
        7,
      );
      candidate = this.getUtcDateFromLocal(
        nextWeek.year,
        nextWeek.month,
        nextWeek.day,
        hours,
        minutes,
        input.timezone,
      );
    }

    return candidate;
  }

  /**
   * Deterministically resolve which reporting period a scheduled execution refers to.
   *
   * Semantics:
   * - FIRST_DAY / FIRST_WORKING_DAY -> refers to PREVIOUS calendar month's reports.
   * - LAST_DAY / LAST_WORKING_DAY / DAYS_BEFORE_MONTH_END -> refers to CURRENT calendar month's reports.
   */
  resolveReportPeriod(
    scheduleType: ReportNotificationScheduleType,
    runDate: Date,
    timezone?: string | null,
  ): { reportYear: number; reportMonth: number; label: string } {
    const tz = this.normalizeTimezone(timezone);
    const { year, month } = this.getLocalYearMonth(runDate, tz);

    if (
      scheduleType === ReportNotificationScheduleType.FIRST_DAY ||
      scheduleType === ReportNotificationScheduleType.FIRST_WORKING_DAY
    ) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      return {
        reportYear: prevYear,
        reportMonth: prevMonth,
        label: `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
      };
    }

    return {
      reportYear: year,
      reportMonth: month,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    };
  }

  resolveReportingPeriod(input: {
    frequency?: ReportNotificationFrequency | null;
    scheduleType?: ReportNotificationScheduleType | null;
    weeklyDay?: ReportNotificationWeekday | null;
    runDate: Date;
    timezone?: string | null;
  }): ResolvedReportPeriod {
    const frequency = input.frequency ?? ReportNotificationFrequency.MONTHLY;
    const timezone = this.normalizeTimezone(input.timezone);

    if (frequency === ReportNotificationFrequency.WEEKLY) {
      return this.resolveWeeklyReportPeriod(input.runDate, timezone);
    }

    if (!input.scheduleType) {
      throw new BadRequestException("Schedule type is required.");
    }

    const monthly = this.resolveReportPeriod(
      input.scheduleType,
      input.runDate,
      timezone,
    );
    const periodStart = this.getUtcDateFromLocal(
      monthly.reportYear,
      monthly.reportMonth,
      1,
      0,
      0,
      timezone,
    );
    const nextMonthYear =
      monthly.reportMonth === 12 ? monthly.reportYear + 1 : monthly.reportYear;
    const nextMonth = monthly.reportMonth === 12 ? 1 : monthly.reportMonth + 1;
    const nextPeriodStart = this.getUtcDateFromLocal(
      nextMonthYear,
      nextMonth,
      1,
      0,
      0,
      timezone,
    );

    return {
      ...monthly,
      periodStart,
      periodEnd: new Date(nextPeriodStart.getTime() - 1),
    };
  }

  private resolveWeeklyReportPeriod(
    runDate: Date,
    timezone: string,
  ): ResolvedReportPeriod {
    const local = this.getLocalDateTimeParts(runDate, timezone);
    const currentDow = this.getDayOfWeek(local.year, local.month, local.day);
    const daysSinceMonday = currentDow === 0 ? 6 : currentDow - 1;
    const monday = this.addLocalDays(
      local.year,
      local.month,
      local.day,
      -daysSinceMonday,
    );
    const nextMonday = this.addLocalDays(
      monday.year,
      monday.month,
      monday.day,
      7,
    );
    const sunday = this.addLocalDays(
      monday.year,
      monday.month,
      monday.day,
      6,
    );
    const periodStart = this.getUtcDateFromLocal(
      monday.year,
      monday.month,
      monday.day,
      0,
      0,
      timezone,
    );
    const nextPeriodStart = this.getUtcDateFromLocal(
      nextMonday.year,
      nextMonday.month,
      nextMonday.day,
      0,
      0,
      timezone,
    );

    return {
      reportYear: monday.year,
      reportMonth: monday.month,
      periodStart,
      periodEnd: new Date(nextPeriodStart.getTime() - 1),
      label: this.formatWeeklyPeriodLabel(monday, sunday),
    };
  }

  private formatWeeklyPeriodLabel(
    start: { year: number; month: number; day: number },
    end: { year: number; month: number; day: number },
  ): string {
    const startMonth = MONTH_NAMES[start.month - 1];
    const endMonth = MONTH_NAMES[end.month - 1];

    if (start.year === end.year && start.month === end.month) {
      return `${startMonth} ${start.day}-${end.day}, ${start.year}`;
    }

    if (start.year === end.year) {
      return `${startMonth} ${start.day} - ${endMonth} ${end.day}, ${start.year}`;
    }

    return `${startMonth} ${start.day}, ${start.year} - ${endMonth} ${end.day}, ${end.year}`;
  }

  /**
   * Computes a full schedule preview.
   */
  generatePreview(input: CalculateScheduleInput): SchedulePreviewResult {
    const timezone = this.normalizeTimezone(input.timezone);
    const frequency = input.frequency ?? ReportNotificationFrequency.MONTHLY;
    const nextRunAt = this.calculateNextRunAt({ ...input, timezone });
    const { reportYear, reportMonth, periodStart, periodEnd, label } =
      this.resolveReportingPeriod({
        frequency,
        scheduleType: input.scheduleType,
        weeklyDay: input.weeklyDay,
        runDate: nextRunAt,
        timezone,
      });

    return {
      frequency,
      scheduleType:
        frequency === ReportNotificationFrequency.MONTHLY
          ? input.scheduleType!
          : null,
      weeklyDay:
        frequency === ReportNotificationFrequency.WEEKLY
          ? input.weeklyDay!
          : null,
      daysBeforeMonthEnd:
        frequency === ReportNotificationFrequency.MONTHLY &&
        input.scheduleType ===
        ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END
          ? input.daysBeforeMonthEnd ?? 1
          : null,
      sendTime: input.sendTime,
      timezone,
      nextRunAt,
      reportYear,
      reportMonth,
      periodStart,
      periodEnd,
      reportPeriodLabel: label,
    };
  }
}
