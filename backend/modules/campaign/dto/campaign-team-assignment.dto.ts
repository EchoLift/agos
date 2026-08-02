import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CampaignAssignmentRole } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";

export class CreateCampaignTeamAssignmentDto {
  @ApiProperty({ example: "membership-uuid" })
  @IsString()
  membershipId!: string;

  @ApiProperty({
    enum: CampaignAssignmentRole,
    example: CampaignAssignmentRole.WRITER,
  })
  @IsEnum(CampaignAssignmentRole)
  assignmentRole!: CampaignAssignmentRole;
}

export class UpdateCampaignTeamAssignmentDto {
  @ApiPropertyOptional({ example: "membership-uuid" })
  @IsOptional()
  @IsString()
  membershipId?: string;

  @ApiPropertyOptional({
    enum: CampaignAssignmentRole,
    example: CampaignAssignmentRole.EDITOR,
  })
  @IsOptional()
  @IsEnum(CampaignAssignmentRole)
  assignmentRole?: CampaignAssignmentRole;

  @ApiProperty({ example: 2 })
  @IsInt()
  version!: number;
}
