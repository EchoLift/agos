import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export enum ContentAssetType {
  REEL = "REEL",
  CAROUSEL = "CAROUSEL",
  STATIC = "STATIC",
  STORY = "STORY",
  BLOG = "BLOG",
  YOUTUBE = "YOUTUBE",
  AD = "AD",
  OTHER = "OTHER",
}

export class CreateContentAssetDto {
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsUUID()
  clientId!: string;

  @IsUUID()
  campaignId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayCode?: string;

  @IsEnum(ContentAssetType)
  type!: ContentAssetType;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  brief!: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string | null;
}
