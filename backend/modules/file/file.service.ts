import { Injectable } from '@nestjs/common';
import { PrismaService } from '@packages/database/prisma.service';
import { AttachExternalFileDto } from './dto/attach-external-file.dto';

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  attachExternalLink(dto: AttachExternalFileDto) {
    return this.prisma.fileAsset.create({
      data: {
        agencyId: dto.agencyId,
        contentAssetId: dto.contentAssetId,
        uploaderId: dto.uploaderId,
        filename: dto.filename,
        externalUrl: dto.externalUrl,
        fileType: dto.fileType
      }
    });
  }
}

