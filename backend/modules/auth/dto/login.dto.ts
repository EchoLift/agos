import { IntersectionType } from "@nestjs/mapped-types";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { EmailDto } from "./email.dto";
import { PasswordDto } from "./password.dto";

export class LoginDto extends IntersectionType(EmailDto, PasswordDto) {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiPropertyOptional({
    example: "MacBook Pro - Chrome",
    description: "Device label for session management",
  })
  deviceLabel?: string;
}
