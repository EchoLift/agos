import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  ClientAnalyticsService,
  MAX_FILES_PER_REQUEST,
  MAX_SINGLE_FILE_SIZE,
} from "./client-analytics.service";
import { UploadAnalyticsFilesDto } from "./dto/upload-analytics-files.dto";
import { QueryAnalyticsFilesDto } from "./dto/query-analytics-files.dto";

@ApiTags("Client Analytics")
@ApiBearerAuth()
@Controller({ path: "clients/:clientId/analytics/files", version: "1" })
export class ClientAnalyticsController {
  constructor(private readonly analyticsService: ClientAnalyticsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor("files", MAX_FILES_PER_REQUEST, {
      limits: {
        fileSize: MAX_SINGLE_FILE_SIZE,
        files: MAX_FILES_PER_REQUEST,
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload multiple analytics files for a client",
    description:
      "Uploads multiple analytics-related files (up to 20 files, 25MB each, max 100MB aggregate). Files are server-classified and stored in Cloudflare R2.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Upload batch processed with structured summary and failures.",
  })
  async uploadFiles(
    @Param("clientId") clientId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadAnalyticsFilesDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.analyticsService.uploadFiles(clientId, files || [], dto, user);
  }

  @Get()
  @ApiOperation({
    summary: "Get grouped analytics files for a client",
    description:
      "Returns files grouped by category (Images, PDFs, Spreadsheets, Documents, Videos, Other) for the specified reporting period.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Grouped analytics files list.",
  })
  async getFiles(
    @Param("clientId") clientId: string,
    @Query() query: QueryAnalyticsFilesDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.analyticsService.getFilesGrouped(clientId, query, user);
  }

  @Get(":fileId/download")
  @ApiOperation({
    summary: "Generate short-lived signed URL for file download/preview",
    description:
      "Generates a 300-second presigned Cloudflare R2 URL preserving the original filename in Content-Disposition.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Signed download/preview URL.",
  })
  async getDownloadUrl(
    @Param("clientId") clientId: string,
    @Param("fileId") fileId: string,
    @Query("inline") inline: string,
    @CurrentUser() user: IdentityContext,
  ) {
    const isInline = inline === "true" || inline === "1";
    return this.analyticsService.getDownloadSignedUrl(
      clientId,
      fileId,
      user,
      isInline,
    );
  }

  @Delete(":fileId")
  @ApiOperation({
    summary: "Soft-delete an analytics file",
    description:
      "Marks the file asset as deleted while preserving audit traceability.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "File successfully soft-deleted.",
  })
  async deleteFile(
    @Param("clientId") clientId: string,
    @Param("fileId") fileId: string,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.analyticsService.deleteFile(clientId, fileId, user);
  }
}
