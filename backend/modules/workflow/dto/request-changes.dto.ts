import { ContentStage } from "@prisma/client";
import { IsEnum, IsString, IsUUID } from "class-validator";

export class RequestChangesDto {
  @IsUUID()
  actorId!: string;

  @IsUUID()
  workflowTaskId!: string;

  @IsString()
  comment!: string;

  @IsUUID()
  returnToOwnerId!: string;

  @IsEnum(ContentStage)
  returnToStage!: ContentStage;

  @IsUUID()
  returnWorkflowStepId!: string;
}
