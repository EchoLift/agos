import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { assertClientScope } from "@packages/security/client-scope";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { AttachExternalFileDto } from "./dto/attach-external-file.dto";

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  async attachExternalLink(dto: AttachExternalFileDto, actor?: IdentityContext) {
    const agencyId = actor?.agencyId ?? dto.agencyId;
    const uploaderId = actor?.membershipId ?? dto.uploaderId;
    if (!agencyId || !uploaderId) {
      throw new BadRequestException("Agency and uploader context is required");
    }

    const contentAsset = await this.prisma.contentAsset.findFirst({
      where: { id: dto.contentAssetId, agencyId },
      select: { id: true, clientId: true },
    });
    if (!contentAsset) {
      throw new NotFoundException("Content asset not found");
    }
    assertClientScope(actor, contentAsset.clientId);

    return this.prisma.fileAsset.create({
      data: {
        agencyId,
        contentAssetId: dto.contentAssetId,
        uploaderId,
        filename: dto.filename,
        externalUrl: dto.externalUrl,
        fileType: dto.fileType,
      },
    });
  }
}
