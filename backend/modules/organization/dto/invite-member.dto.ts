import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayUnique,
  IsUUID,
} from "class-validator";

export class InviteMemberDto {
  @ApiProperty({
    example: "editor@example.com",
    description: "Email address of the invitee",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: "+15551234567",
    description: "Mobile phone number of the invitee",
    required: false,
  })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiProperty({
    example: "role-uuid-or-system-role-id",
    description: "Role ID to assign to the member",
  })
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @ApiProperty({
    example: ["role-writer-uuid", "role-editor-uuid"],
    description:
      "Optional additional role IDs to assign. roleId is always included as the primary role.",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleIds?: string[];

  @ApiProperty({
    example: "client-uuid",
    description: "Business client represented by CLIENT-role invitees",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({
    example: ["client-uuid-1", "client-uuid-2"],
    description: "Business clients represented by CLIENT-role invitees",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  clientIds?: string[];
}
