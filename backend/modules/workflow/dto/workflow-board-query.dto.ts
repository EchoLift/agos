import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ContentRisk } from '@prisma/client';

export class WorkflowBoardQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsEnum(ContentRisk)
  risk?: ContentRisk;

  @IsOptional()
  @IsString()
  search?: string;
}
