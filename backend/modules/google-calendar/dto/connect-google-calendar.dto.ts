import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class ConnectGoogleCalendarDto {
  @ApiPropertyOptional({ example: "socia-expert" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  agencySlug?: string;
}
