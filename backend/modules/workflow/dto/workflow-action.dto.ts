import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  isURL,
  IsUrl,
  MaxLength,
} from "class-validator";

export enum WorkflowActionType {
  SUBMIT_FOR_REVIEW = "SUBMIT_FOR_REVIEW",
  APPROVE = "APPROVE",
  ACCEPT_HANDOVER = "ACCEPT_HANDOVER",
  REQUEST_CHANGES = "REQUEST_CHANGES",
  REJECT = "REJECT",
  BLOCK = "BLOCK",
  UNBLOCK = "UNBLOCK",
}

export class WorkflowActionDto {
  @IsEnum(WorkflowActionType)
  action!: WorkflowActionType;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
  })
  externalLink?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  allowMissingAssignee?: boolean;
}
