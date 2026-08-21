import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { AnalyticsFileCategory } from "@prisma/client";

export class QueryAnalyticsFilesDto {
  @ApiPropertyOptional({
    description: "Filter by reporting year (e.g. 2026). Defaults to current year.",
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: "Filter by reporting month (1-12). Defaults to current month.",
    example: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description: "Filter by file category",
    enum: AnalyticsFileCategory,
  })
  @IsOptional()
  @IsEnum(AnalyticsFileCategory)
  category?: AnalyticsFileCategory;
}
