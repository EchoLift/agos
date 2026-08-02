import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export const CALENDAR_SCOPES = [
  "MY_SCHEDULE",
  "MY_ROLE",
  "MY_TEAM",
  "CAMPAIGN",
  "AGENCY",
] as const;

export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

export class CalendarEventsQueryDto {
  @ApiPropertyOptional({ enum: CALENDAR_SCOPES, example: "MY_SCHEDULE" })
  @IsOptional()
  @IsIn(CALENDAR_SCOPES)
  scope?: CalendarScope;

  @ApiPropertyOptional({ example: "2026-08-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-08-31T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: "campaign-uuid" })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ example: "membership-uuid" })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ example: "WORKFLOW_TASK,PUBLISHING" })
  @IsOptional()
  @IsString()
  eventTypes?: string;

  @ApiPropertyOptional({ example: "TODO,IN_PROGRESS,SCHEDULED" })
  @IsOptional()
  @IsString()
  statuses?: string;

  @ApiPropertyOptional({ example: "INSTAGRAM,YOUTUBE" })
  @IsOptional()
  @IsString()
  platforms?: string;
}
