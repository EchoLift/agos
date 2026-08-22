import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";
import {
  ReportNotificationExecutionStatus,
  ReportNotificationFrequency,
  ReportNotificationScheduleType,
  ReportNotificationWeekday,
} from "@prisma/client";
import { ALLOWED_DAYS_BEFORE_MONTH_END } from "../services/report-schedule-calculator.service";

function ReportNotificationFrequencyField() {
  return function (target: object, propertyKey: string) {
    ApiPropertyOptional({
      enum: ReportNotificationFrequency,
      description: "Report notification cadence.",
      example: ReportNotificationFrequency.MONTHLY,
      default: ReportNotificationFrequency.MONTHLY,
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsEnum(ReportNotificationFrequency)(target, propertyKey);
  };
}

function ReportNotificationScheduleTypeField() {
  return function (target: object, propertyKey: string) {
    ApiPropertyOptional({
      enum: ReportNotificationScheduleType,
      description: "Recurring monthly schedule template type.",
      example: ReportNotificationScheduleType.LAST_WORKING_DAY,
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsEnum(ReportNotificationScheduleType)(target, propertyKey);
  };
}

function ReportNotificationWeekdayField() {
  return function (target: object, propertyKey: string) {
    ApiPropertyOptional({
      enum: ReportNotificationWeekday,
      description: "Weekday for weekly report notifications.",
      example: ReportNotificationWeekday.FRIDAY,
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsEnum(ReportNotificationWeekday)(target, propertyKey);
  };
}

function DaysBeforeMonthEndField() {
  return function (target: object, propertyKey: string) {
    ApiPropertyOptional({
      description:
        "Number of days before month end (1, 2, 3, 5, 7). Required only for DAYS_BEFORE_MONTH_END.",
      example: 3,
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsNumber()(target, propertyKey);
    IsIn(ALLOWED_DAYS_BEFORE_MONTH_END as unknown as number[])(
      target,
      propertyKey,
    );
  };
}

function SendTimeField() {
  return function (target: object, propertyKey: string) {
    ApiProperty({
      description: "Send time in 24-hour HH:mm format.",
      example: "10:00",
    })(target, propertyKey);
    IsString()(target, propertyKey);
    Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: "sendTime must be in 24-hour HH:mm format (e.g. 10:00).",
    })(target, propertyKey);
  };
}

function TimezoneField() {
  return function (target: object, propertyKey: string) {
    ApiPropertyOptional({
      description: "IANA timezone identifier.",
      example: "Asia/Kolkata",
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsString()(target, propertyKey);
  };
}

function EnabledField() {
  return function (target: object, propertyKey: string) {
    ApiPropertyOptional({
      description: "Whether the recurring notification schedule is enabled.",
      default: true,
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsBoolean()(target, propertyKey);
  };
}

export class UpsertReportNotificationScheduleDto {
  @ReportNotificationFrequencyField()
  frequency?: ReportNotificationFrequency;

  @ReportNotificationScheduleTypeField()
  scheduleType?: ReportNotificationScheduleType;

  @ReportNotificationWeekdayField()
  weeklyDay?: ReportNotificationWeekday;

  @DaysBeforeMonthEndField()
  daysBeforeMonthEnd?: number;

  @SendTimeField()
  sendTime!: string;

  @TimezoneField()
  timezone?: string;

  @EnabledField()
  enabled?: boolean;
}

export class PreviewReportNotificationScheduleDto {
  @ReportNotificationFrequencyField()
  frequency?: ReportNotificationFrequency;

  @ReportNotificationScheduleTypeField()
  scheduleType?: ReportNotificationScheduleType;

  @ReportNotificationWeekdayField()
  weeklyDay?: ReportNotificationWeekday;

  @DaysBeforeMonthEndField()
  daysBeforeMonthEnd?: number;

  @SendTimeField()
  sendTime!: string;

  @TimezoneField()
  timezone?: string;

  @EnabledField()
  enabled?: boolean;
}

export interface LastExecutionSummary {
  id: string;
  status: ReportNotificationExecutionStatus;
  reportYear: number;
  reportMonth: number;
  reportPeriodLabel: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  scheduledAt: Date;
  sentAt: Date | null;
  attemptCount: number;
  lastAttemptAt: Date | null;
  recipientCount: number;
  errorDetails: string | null;
}

export interface ReportNotificationScheduleResponse {
  configured: boolean;
  id: string | null;
  agencyId: string;
  clientId: string;
  frequency: ReportNotificationFrequency;
  scheduleType: ReportNotificationScheduleType | null;
  daysBeforeMonthEnd: number | null;
  weeklyDay: ReportNotificationWeekday | null;
  sendTime: string | null;
  timezone: string;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastExecution: LastExecutionSummary | null;
}
