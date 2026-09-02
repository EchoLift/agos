import { SubscriptionStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateEntitlementDto {
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  plan!: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}
