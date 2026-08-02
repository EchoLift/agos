import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ContentService } from "./content.service";
import { CreateContentAssetDto } from "./dto/create-content-asset.dto";
import { UpdateContentAssetDto } from "./dto/update-content-asset.dto";

@ApiTags("Content Assets")
@ApiBearerAuth()
@Controller({ path: "content-assets", version: "1" })
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  create(
    @Body() dto: CreateContentAssetDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.contentService.create(dto, user.agencyId, user.userId);
  }

  @Get()
  findMany(@CurrentUser() user: IdentityContext) {
    return this.contentService.findMany(user.agencyId ?? "");
  }

  @Get(":id")
  findById(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.contentService.findById(id, user.agencyId ?? "");
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateContentAssetDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.contentService.update(
      id,
      dto,
      user.agencyId ?? "",
      user.userId,
    );
  }

  @Post(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.contentService.archive(id, user.agencyId ?? "", user.userId);
  }

  @Post(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.contentService.restore(id, user.agencyId ?? "", user.userId);
  }
}
