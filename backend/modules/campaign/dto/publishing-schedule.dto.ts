import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentType, PublishingPlatform } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreatePublishingScheduleDto {
  @ApiProperty({ enum: PublishingPlatform, example: PublishingPlatform.INSTAGRAM })
  @IsEnum(PublishingPlatform)
  platform!: PublishingPlatform;

  @ApiProperty({ example: '2026-08-04T19:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  timezone!: string;

  @ApiPropertyOptional({ example: 'content-asset-uuid' })
  @IsOptional()
  @IsString()
  contentAssetId?: string;

  @ApiPropertyOptional({ example: 'Launch caption draft' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ example: 'Use festival CTA' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePublishingScheduleDto {
  @ApiPropertyOptional({ enum: PublishingPlatform, example: PublishingPlatform.YOUTUBE })
  @IsOptional()
  @IsEnum(PublishingPlatform)
  platform?: PublishingPlatform;

  @ApiPropertyOptional({ example: '2026-08-05T18:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'content-asset-uuid' })
  @IsOptional()
  @IsString()
  contentAssetId?: string;

  @ApiPropertyOptional({ example: 'Updated caption' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ example: 'Updated note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  version!: number;
}

export class CancelPublishingScheduleDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  version!: number;

  @ApiProperty({ example: 'Client postponed launch' })
  @IsString()
  cancellationReason!: string;
}

export class MarkPublishingSchedulePublishedDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  version!: number;

  @ApiProperty({ example: 'https://instagram.com/reel/abc' })
  @IsUrl()
  publishedUrl!: string;

  @ApiPropertyOptional({ example: '2026-08-04T19:05:00.000Z' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}

export class GeneratePublishingProductionDto {
  @ApiProperty({ enum: ContentType, example: ContentType.REEL })
  @IsEnum(ContentType)
  contentType!: ContentType;

  @ApiProperty({ example: 'Reel 1' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Create a conversion-focused launch reel.' })
  @IsOptional()
  @IsString()
  brief?: string;

  @ApiPropertyOptional({ example: 'manager-membership-uuid' })
  @IsOptional()
  @IsString()
  managerMembershipId?: string;

  @ApiPropertyOptional({ example: 'writer-membership-uuid' })
  @IsOptional()
  @IsString()
  writerMembershipId?: string;

  @ApiPropertyOptional({ example: '2026-08-05T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scriptDueAt?: string;
}
