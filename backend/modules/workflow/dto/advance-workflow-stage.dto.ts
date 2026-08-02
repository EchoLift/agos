import { ContentStage } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class AdvanceWorkflowStageDto {
  @IsUUID()
  actorId!: string;

  @IsEnum(ContentStage)
  toStage!: ContentStage;

  @IsOptional()
  @IsString()
  reason?: string;
}
