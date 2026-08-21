import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
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
import {
  PreviewReportNotificationScheduleDto,
  UpsertReportNotificationScheduleDto,
} from "./dto/report-notification-schedule.dto";

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

  // ─── Report Notification Schedule ──────────────────────────────────────────

  @Get("notification-schedule")
  @ApiOperation({
    summary: "Get report notification schedule for a client",
    description: "Returns the recurring monthly report notification configuration, next run time, and last execution status.",
  })
  @ApiResponse({ status: HttpStatus.OK, description: "Schedule configuration or unconfigured state." })
  async getReportNotificationSchedule(
    @Param("clientId") clientId: string,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.analyticsService.getReportNotificationSchedule(clientId, user);
  }

  @Put("notification-schedule")
  @ApiOperation({
    summary: "Create or update report notification schedule for a client",
    description: "Upserts the monthly report notification schedule. Only non-client-scoped agency users may configure this. Calculates nextRunAt from the provided schedule template and timezone.",
  })
  @ApiResponse({ status: HttpStatus.OK, description: "Updated schedule configuration." })
  async upsertReportNotificationSchedule(
    @Param("clientId") clientId: string,
    @Body() dto: UpsertReportNotificationScheduleDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.analyticsService.upsertReportNotificationSchedule(clientId, dto, user);
  }

  @Post("notification-schedule/preview")
  @ApiOperation({
    summary: "Preview next run date and reporting period for a schedule configuration",
    description: "Returns the backend-computed nextRunAt and resolved reporting period label for a proposed schedule configuration without saving it.",
  })
  @ApiResponse({ status: HttpStatus.OK, description: "Preview result with nextRunAt and reportPeriodLabel." })
  async previewReportNotificationSchedule(
    @Param("clientId") _clientId: string,
    @Body() dto: PreviewReportNotificationScheduleDto,
  ) {
    return this.analyticsService.previewReportNotificationSchedule(
      dto.scheduleType,
      dto.daysBeforeMonthEnd ?? null,
      dto.sendTime,
      dto.timezone ?? null,
    );
  }
}
