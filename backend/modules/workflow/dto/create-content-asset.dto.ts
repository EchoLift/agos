import { ContentType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateContentAssetDto {
  @IsUUID()
  agencyId!: string;

  @IsUUID()
  actorId!: string;

  @IsUUID()
  clientId!: string;

  @IsUUID()
  campaignId!: string;

  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  title!: string;

  @IsString()
  brief!: string;

  @IsOptional()
  @IsUUID()
  currentOwnerMembershipId?: string;

  @IsUUID()
  managerMembershipId!: string;

  @IsDateString()
  deadlineAt!: string;
}
