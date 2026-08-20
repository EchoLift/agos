import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class SubmitWorkOrderDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
  })
  @MaxLength(1000)
  externalLink?: string;
}

export class ReviewWorkOrderDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
