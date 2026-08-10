import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { WorkOrderPriority, WorkOrderType } from "@prisma/client";

export class CreateWorkOrderDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(WorkOrderType)
  workType?: WorkOrderType;

  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @IsUUID()
  assigneeMembershipId!: string;

  @IsOptional()
  @IsUUID()
  reviewerMembershipId?: string;

  @IsString()
  dueAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  rewardCurrency?: string;
}
