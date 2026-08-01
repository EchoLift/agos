import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordDto {
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @ApiProperty({ example: 'StrongPassword123!', description: 'Password (min 12, max 128 chars)' })
  password!: string;
}
