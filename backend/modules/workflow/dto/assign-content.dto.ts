import { ContentStage } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class AssignContentDto {
  @IsUUID()
  actorId!: string;

  @IsUUID()
  assigneeId!: string;

  @IsOptional()
  @IsUUID()
  workflowStepId?: string;

  @IsEnum(ContentStage)
  stage!: ContentStage;

  @IsDateString()
  deadlineAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
