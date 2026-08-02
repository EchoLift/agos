import { PresenceStatus, WorkLocation } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateStatusDto {
  @IsEnum(PresenceStatus)
  status!: PresenceStatus;

  @IsOptional()
  @IsEnum(WorkLocation)
  location?: WorkLocation | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  message?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
