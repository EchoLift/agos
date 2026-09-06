import { PricingDiscountType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreatePricingDiscountDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsEnum(PricingDiscountType) type!: PricingDiscountType;
  @Type(() => Number) @IsInt() @Min(1) value!: number;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxRedemptions?:
    number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxRedemptionsPerAgency?:
    number | null;
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  planIds!: string[];
}

export class UpdatePricingDiscountDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsEnum(PricingDiscountType) type?: PricingDiscountType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) value?: number;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxRedemptions?:
    number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxRedemptionsPerAgency?:
    number | null;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  planIds?: string[];
}
