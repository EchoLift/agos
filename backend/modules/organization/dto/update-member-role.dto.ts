import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class UpdateMemberRoleDto {
  @ApiProperty({
    example: "role-uuid",
    description: "Primary predefined agency role ID to assign",
  })
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @ApiProperty({
    example: ["role-uuid", "another-role-uuid"],
    description:
      "Full set of predefined agency role IDs to assign. Defaults to roleId for older clients.",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiProperty({
    example: 2,
    description: "Current membership version for optimistic locking",
  })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({
    example: "client-uuid",
    description: "Business client required when assigning the CLIENT role",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
