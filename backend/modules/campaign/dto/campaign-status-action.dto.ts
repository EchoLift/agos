import { IsInt, IsOptional } from "class-validator";

export class CampaignStatusActionDto {
  @IsOptional()
  @IsInt()
  version?: number;
}
