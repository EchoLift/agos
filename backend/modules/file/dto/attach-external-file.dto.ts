import { IsString, IsUrl, IsUUID } from 'class-validator';

export class AttachExternalFileDto {
  @IsUUID()
  agencyId!: string;

  @IsUUID()
  contentAssetId!: string;

  @IsUUID()
  uploaderId!: string;

  @IsString()
  filename!: string;

  @IsUrl()
  externalUrl!: string;

  @IsString()
  fileType!: string;
}

