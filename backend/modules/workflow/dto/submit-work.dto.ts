import { SubmissionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class SubmitWorkDto {
  @IsUUID()
  actorId!: string;

  @IsUUID()
  workflowTaskId!: string;

  @IsEnum(SubmissionType)
  submissionType!: SubmissionType;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsUrl()
  externalLink?: string;
}
