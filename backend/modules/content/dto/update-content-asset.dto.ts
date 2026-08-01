import { PartialType } from '@nestjs/mapped-types';
import { CreateContentAssetDto } from './create-content-asset.dto';

export class UpdateContentAssetDto extends PartialType(CreateContentAssetDto) {}
