import { IsOptional, IsString, MaxLength } from "class-validator";

export class SubmitWorkOrderDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  externalLink?: string;
}

export class ReviewWorkOrderDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
