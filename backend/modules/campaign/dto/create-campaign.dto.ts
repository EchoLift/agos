import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ContentType, PublishingPlatform } from "@prisma/client";

export class CampaignDeliverablePlanDto {
  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @IsOptional()
  @IsString()
  frequency?: string | null;

  @IsOptional()
  @IsString()
  preferredDays?: string | null;

  @IsOptional()
  @IsString()
  preferredTime?: string | null;

  @IsOptional()
  @IsString()
  platform?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

export class PublishingScheduleDraftDto {
  @IsEnum(PublishingPlatform)
  platform!: PublishingPlatform;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  timezone?: string | null;
}

export class CreateCampaignDto {
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsUUID()
  clientId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  campaignType?: string | null;

  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsString()
  goal?: string | null;

  @IsOptional()
  @IsString()
  primaryKpi?: string | null;

  @IsOptional()
  @IsString()
  targetAudience?: string | null;

  @IsOptional()
  @IsBoolean()
  useClientAudience?: boolean;

  @IsOptional()
  @IsString()
  keyMessage?: string | null;

  @IsOptional()
  @IsString()
  cta?: string | null;

  @IsOptional()
  @IsString()
  reviewFrequency?: string | null;

  @IsOptional()
  @IsString()
  workingDays?: string | null;

  @IsOptional()
  @IsDateString()
  launchDate?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  workflowTemplate?: string | null;

  @IsOptional()
  @IsString()
  clientApprover?: string | null;

  @IsOptional()
  @IsUUID()
  agencyApproverMembershipId?: string | null;

  @IsOptional()
  @IsString()
  approvalSla?: string | null;

  @IsOptional()
  @IsString()
  revisionLimit?: string | null;

  @IsOptional()
  @IsString()
  references?: string | null;

  @IsOptional()
  @IsString()
  moodBoardUrl?: string | null;

  @IsOptional()
  @IsString()
  driveFolderUrl?: string | null;

  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  @IsOptional()
  @IsBoolean()
  autoGenerateCalendar?: boolean;

  @IsOptional()
  @IsString()
  postingDays?: string | null;

  @IsOptional()
  @IsString()
  postingWindows?: string | null;

  @IsOptional()
  @IsString()
  blackoutDates?: string | null;

  @IsOptional()
  @IsString()
  platformMix?: string | null;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString({ each: true })
  assignedMembershipIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignDeliverablePlanDto)
  deliverablePlans?: CampaignDeliverablePlanDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublishingScheduleDraftDto)
  publishingSchedules?: PublishingScheduleDraftDto[];
}
