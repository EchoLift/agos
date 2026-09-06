import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreatePricingPlanDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]*$/) @MaxLength(64) code!: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @Type(() => Number) @IsInt() @Min(1) durationMonths!: number;
  @Type(() => Number) @IsInt() @Min(1) priceAmountMinor!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) teamLimit?: number | null;
  @Type(() => Number) @IsInt() displayOrder!: number;
  @IsBoolean() isActive!: boolean;
}

export class UpdatePricingPlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMonths?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) priceAmountMinor?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) teamLimit?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
