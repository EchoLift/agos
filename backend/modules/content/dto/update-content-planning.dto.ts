import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UpdateContentPlanningDto {
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string | null;
}
