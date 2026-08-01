import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateAgencyDto {
  @ApiProperty({ example: 'Social Expert', description: 'Display name shown in the UI header' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  displayName!: string;

  @ApiProperty({ example: 'social-expert', description: 'Unique subdomain slug (agency name)' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 63)
  slug!: string;
}
