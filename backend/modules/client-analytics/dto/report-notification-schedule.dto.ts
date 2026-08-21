import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";
import {
  ReportNotificationExecutionStatus,
  ReportNotificationScheduleType,
} from "@prisma/client";
import { ALLOWED_DAYS_BEFORE_MONTH_END } from "../services/report-schedule-calculator.service";

export class UpsertReportNotificationScheduleDto {
  @ApiProperty({
    enum: ReportNotificationScheduleType,
    description: "Recurring monthly schedule template type.",
    example: ReportNotificationScheduleType.LAST_WORKING_DAY,
  })
  @IsEnum(ReportNotificationScheduleType)
  @IsNotEmpty()
  scheduleType!: ReportNotificationScheduleType;

  @ApiPropertyOptional({
    description:
      "Number of days before month end (1, 2, 3, 5, 7). Required only for DAYS_BEFORE_MONTH_END.",
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @IsIn(ALLOWED_DAYS_BEFORE_MONTH_END as unknown as number[])
  daysBeforeMonthEnd?: number;

  @ApiProperty({
    description: "Send time in 24-hour HH:mm format.",
    example: "10:00",
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "sendTime must be in 24-hour HH:mm format (e.g. 10:00).",
  })
  sendTime!: string;

  @ApiPropertyOptional({
    description: "IANA timezone identifier.",
    example: "Asia/Kolkata",
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: "Whether the recurring notification schedule is enabled.",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PreviewReportNotificationScheduleDto {
  @ApiProperty({
    enum: ReportNotificationScheduleType,
    example: ReportNotificationScheduleType.LAST_WORKING_DAY,
  })
  @IsEnum(ReportNotificationScheduleType)
  @IsNotEmpty()
  scheduleType!: ReportNotificationScheduleType;

  @ApiPropertyOptional({
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @IsIn(ALLOWED_DAYS_BEFORE_MONTH_END as unknown as number[])
  daysBeforeMonthEnd?: number;

  @ApiProperty({
    example: "10:00",
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "sendTime must be in 24-hour HH:mm format (e.g. 10:00).",
  })
  sendTime!: string;

  @ApiPropertyOptional({
    example: "Asia/Kolkata",
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export interface LastExecutionSummary {
  id: string;
  status: ReportNotificationExecutionStatus;
  reportYear: number;
  reportMonth: number;
  reportPeriodLabel: string;
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
  scheduleType: ReportNotificationScheduleType | null;
  daysBeforeMonthEnd: number | null;
  sendTime: string | null;
  timezone: string;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastExecution: LastExecutionSummary | null;
}
