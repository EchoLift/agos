import { ContentStage } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class ApproveContentDto {
  @IsUUID()
  actorId!: string;

  @IsUUID()
  workflowTaskId!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  nextOwnerId?: string;

  @IsOptional()
  @IsEnum(ContentStage)
  nextStage?: ContentStage;

  @IsOptional()
  @IsUUID()
  nextWorkflowStepId?: string;

  @IsOptional()
  @IsDateString()
  nextDeadlineAt?: string;

  @IsString()
  idempotencyKey!: string;
}
