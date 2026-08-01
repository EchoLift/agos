import { IsOptional, IsString, IsUUID } from 'class-validator';

export class BlockContentDto {
  @IsUUID()
  actorId!: string;

  @IsUUID()
  workflowTaskId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;
}
