import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { RequirePermissions } from "@packages/security/decorators/require-permissions.decorator";
import { ContentService } from "./content.service";
import { CreateContentAssetDto } from "./dto/create-content-asset.dto";
import { UpdateContentPlanningDto } from "./dto/update-content-planning.dto";
import { UpdateContentAssetDto } from "./dto/update-content-asset.dto";

@ApiTags("Content Assets")
@ApiBearerAuth()
@Controller({ path: "content-assets", version: "1" })
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @RequirePermissions("CONTENT_CREATE")
  create(
    @Body() dto: CreateContentAssetDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.contentService.create(dto, user.agencyId, user);
  }

  @Get()
  findMany(
    @CurrentUser() user: IdentityContext,
    @Query("campaignId") campaignId?: string,
  ) {
    return this.contentService.findMany(user.agencyId ?? "", campaignId, user);
  }

  @Get(":id")
  findById(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.contentService.findById(id, user.agencyId ?? "", user);
  }

  @Patch(":id")
  @RequirePermissions("CONTENT_CREATE")
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

  @Patch(":id/planning")
  @RequirePermissions("CONTENT_ASSIGN")
  updatePlanning(
    @Param("id") id: string,
    @Body() dto: UpdateContentPlanningDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.contentService.updatePlanning(
      id,
      dto,
      user.agencyId ?? "",
      user,
    );
  }

  @Post(":id/archive")
  @RequirePermissions("CONTENT_CREATE")
  archive(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.contentService.archive(id, user.agencyId ?? "", user.userId);
  }

  @Post(":id/restore")
  @RequirePermissions("CONTENT_CREATE")
  restore(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.contentService.restore(id, user.agencyId ?? "", user.userId);
  }
}
