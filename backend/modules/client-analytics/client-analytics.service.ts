import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { EventBusService } from "@packages/events/event-bus.service";
import { DomainEvents } from "@packages/events/domain-event";
import { assertClientScope } from "@packages/security/client-scope";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  AnalyticsFileCategory,
  ClientAnalyticsAsset,
  ReportNotificationFrequency,
  ReportNotificationScheduleType,
} from "@prisma/client";
import { R2StorageService } from "./r2-storage.service";
import { UploadAnalyticsFilesDto } from "./dto/upload-analytics-files.dto";
import { QueryAnalyticsFilesDto } from "./dto/query-analytics-files.dto";
import { ReportScheduleCalculatorService } from "./services/report-schedule-calculator.service";
import {
  PreviewReportNotificationScheduleDto,
  UpsertReportNotificationScheduleDto,
  ReportNotificationScheduleResponse,
} from "./dto/report-notification-schedule.dto";
import {
  CategoryCountDto,
  CategoryGroupDto,
  GroupedAnalyticsFilesResponseDto,
  PeriodDto,
  SignedUrlResponseDto,
  UploadAnalyticsResponseDto,
  UploadFailureDto,
} from "./dto/analytics-file-response.dto";

export const MAX_FILES_PER_REQUEST = 20;
export const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_AGGREGATE_PAYLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const CATEGORY_LABELS: Record<AnalyticsFileCategory, string> = {
  [AnalyticsFileCategory.IMAGE]: "Images",
  [AnalyticsFileCategory.PDF]: "PDF Reports",
  [AnalyticsFileCategory.SPREADSHEET]: "Spreadsheets",
  [AnalyticsFileCategory.DOCUMENT]: "Documents",
  [AnalyticsFileCategory.VIDEO]: "Videos",
  [AnalyticsFileCategory.OTHER]: "Other",
};

const CATEGORY_ORDER: AnalyticsFileCategory[] = [
  AnalyticsFileCategory.IMAGE,
  AnalyticsFileCategory.PDF,
  AnalyticsFileCategory.SPREADSHEET,
  AnalyticsFileCategory.DOCUMENT,
  AnalyticsFileCategory.VIDEO,
  AnalyticsFileCategory.OTHER,
];

@Injectable()
export class ClientAnalyticsService {
  private readonly logger = new Logger(ClientAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
    private readonly eventBus: EventBusService,
    private readonly scheduleCalculator: ReportScheduleCalculatorService,
  ) {}

  classifyAnalyticsFile(
    mimeType: string,
    fileName: string,
  ): AnalyticsFileCategory {
    const mime = (mimeType || "").toLowerCase();
    const ext = (fileName.split(".").pop() || "").toLowerCase();

    if (
      mime.startsWith("image/") ||
      [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "svg",
        "bmp",
        "ico",
        "tiff",
        "avif",
      ].includes(ext)
    ) {
      return AnalyticsFileCategory.IMAGE;
    }

    if (
      mime.startsWith("video/") ||
      ["mp4", "mov", "avi", "mkv", "webm", "wmv", "flv"].includes(ext)
    ) {
      return AnalyticsFileCategory.VIDEO;
    }

    if (mime === "application/pdf" || ext === "pdf") {
      return AnalyticsFileCategory.PDF;
    }

    if (
      mime === "text/csv" ||
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      ["csv", "xls", "xlsx", "tsv", "ods"].includes(ext)
    ) {
      return AnalyticsFileCategory.SPREADSHEET;
    }

    if (
      mime.includes("word") ||
      mime.includes("document") ||
      mime.startsWith("text/") ||
      ["doc", "docx", "txt", "rtf", "odt", "md", "pages"].includes(ext)
    ) {
      return AnalyticsFileCategory.DOCUMENT;
    }

    return AnalyticsFileCategory.OTHER;
  }

  getPeriodDto(year: number, month: number): PeriodDto {
    const monthName = MONTH_NAMES[month - 1] || `Month ${month}`;
    return {
      year,
      month,
      label: `${monthName} ${year}`,
    };
  }

  async uploadFiles(
    clientId: string,
    files: Express.Multer.File[],
    dto: UploadAnalyticsFilesDto,
    actor?: IdentityContext,
  ): Promise<UploadAnalyticsResponseDto> {
    const agencyId = actor?.agencyId;
    const userId = actor?.userId;

    if (!agencyId || !userId) {
      throw new BadRequestException("Agency and user context required.");
    }

    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided for upload.");
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(
        `Exceeded maximum limit of ${MAX_FILES_PER_REQUEST} files per upload.`,
      );
    }

    const totalPayloadSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (totalPayloadSize > MAX_AGGREGATE_PAYLOAD_SIZE) {
      throw new PayloadTooLargeException(
        `Total upload size exceeds the ${MAX_AGGREGATE_PAYLOAD_SIZE / (1024 * 1024)}MB aggregate limit.`,
      );
    }

    // Verify client exists and belongs to target agency
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, agencyId, deletedAt: null },
      select: { id: true, agencyId: true, name: true },
    });
    if (!client) {
      throw new NotFoundException("Client not found.");
    }

    assertClientScope(actor, clientId);

    const now = new Date();
    const year = dto.year ?? now.getUTCFullYear();
    const month = dto.month ?? now.getUTCMonth() + 1;

    const period = this.getPeriodDto(year, month);
    const uploadedAssets: ClientAnalyticsAsset[] = [];
    const failures: UploadFailureDto[] = [];

    // Process files with explicit per-file partial success semantics
    for (const file of files) {
      const fileName = file.originalname || "unnamed-file";

      if (file.size > MAX_SINGLE_FILE_SIZE) {
        failures.push({
          fileName,
          code: "FILE_TOO_LARGE",
          message: `File exceeds maximum single file limit of ${MAX_SINGLE_FILE_SIZE / (1024 * 1024)}MB.`,
        });
        continue;
      }

      const category = this.classifyAnalyticsFile(file.mimetype, fileName);
      const ext = fileName.includes(".")
        ? fileName.split(".").pop()?.toLowerCase() || null
        : null;

      const objectKey = this.r2Storage.buildClientAnalyticsKey({
        agencyId,
        clientId,
        year,
        month,
        category,
        fileName,
      });

      let r2Uploaded = false;
      try {
        await this.r2Storage.uploadObject({
          key: objectKey,
          body: file.buffer,
          contentType: file.mimetype || "application/octet-stream",
        });
        r2Uploaded = true;

        const asset = await this.prisma.clientAnalyticsAsset.create({
          data: {
            agencyId,
            clientId,
            uploadedByUserId: userId,
            originalFileName: fileName,
            objectKey,
            mimeType: file.mimetype || "application/octet-stream",
            extension: ext,
            sizeBytes: BigInt(file.size),
            category,
            year,
            month,
          },
        });

        uploadedAssets.push(asset);
      } catch (err: unknown) {
        this.logger.error(
          `Failed processing file ${fileName} for client ${clientId}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );

        if (r2Uploaded) {
          // Compensating cleanup to avoid orphaned R2 objects
          await this.r2Storage.deleteObject(objectKey);
        }

        failures.push({
          fileName,
          code: "UPLOAD_FAILED",
          message: "File could not be stored.",
        });
      }
    }

    if (uploadedAssets.length > 0) {
      await this.eventBus.publish(DomainEvents.ClientAnalyticsAssetUploaded, {
        agencyId,
        actorId: userId,
        payload: {
          clientId,
          year,
          month,
          uploadedCount: uploadedAssets.length,
          assetIds: uploadedAssets.map((a) => a.id),
        },
      });
    }

    // Compute category counts for successfully uploaded batch
    const categoryCountMap = new Map<AnalyticsFileCategory, number>();
    for (const asset of uploadedAssets) {
      const current = categoryCountMap.get(asset.category) || 0;
      categoryCountMap.set(asset.category, current + 1);
    }

    const groups: CategoryCountDto[] = CATEGORY_ORDER.filter(
      (cat) => (categoryCountMap.get(cat) || 0) > 0,
    ).map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      count: categoryCountMap.get(cat) || 0,
    }));

    return {
      uploaded: uploadedAssets.length,
      failed: failures.length,
      period,
      groups,
      failures,
    };
  }

  async getFilesGrouped(
    clientId: string,
    dto: QueryAnalyticsFilesDto,
    actor?: IdentityContext,
  ): Promise<GroupedAnalyticsFilesResponseDto> {
    const agencyId = actor?.agencyId;
    if (!agencyId) {
      throw new BadRequestException("Agency context required.");
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, agencyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException("Client not found.");
    }

    assertClientScope(actor, clientId);

    const now = new Date();
    const year = dto.year ?? now.getUTCFullYear();
    const month = dto.month ?? now.getUTCMonth() + 1;
    const period = this.getPeriodDto(year, month);

    const assets = await this.prisma.clientAnalyticsAsset.findMany({
      where: {
        agencyId,
        clientId,
        year,
        month,
        ...(dto.category ? { category: dto.category } : {}),
        deletedAt: null,
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const groupsMap = new Map<AnalyticsFileCategory, any[]>();
    for (const cat of CATEGORY_ORDER) {
      groupsMap.set(cat, []);
    }

    for (const asset of assets) {
      const catList = groupsMap.get(asset.category);
      if (catList) {
        catList.push({
          id: asset.id,
          originalFileName: asset.originalFileName,
          mimeType: asset.mimeType,
          extension: asset.extension,
          sizeBytes: Number(asset.sizeBytes),
          category: asset.category,
          year: asset.year,
          month: asset.month,
          createdAt: asset.createdAt.toISOString(),
          uploadedBy: asset.uploadedByUser
            ? {
                id: asset.uploadedByUser.id,
                name: asset.uploadedByUser.name,
              }
            : null,
        });
      }
    }

    const groups: CategoryGroupDto[] = (
      dto.category ? [dto.category] : CATEGORY_ORDER
    ).map((cat) => {
      const files = groupsMap.get(cat) || [];
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        count: files.length,
        files,
      };
    });

    return {
      period,
      totalFiles: assets.length,
      groups,
    };
  }

  async getDownloadSignedUrl(
    clientId: string,
    fileId: string,
    actor?: IdentityContext,
    inline = false,
  ): Promise<SignedUrlResponseDto> {
    const agencyId = actor?.agencyId;
    if (!agencyId) {
      throw new BadRequestException("Agency context required.");
    }

    assertClientScope(actor, clientId);

    const asset = await this.prisma.clientAnalyticsAsset.findFirst({
      where: {
        id: fileId,
        clientId,
        agencyId,
        deletedAt: null,
      },
    });

    if (!asset) {
      throw new NotFoundException("File not found or has been deleted.");
    }

    const url = await this.r2Storage.getSignedDownloadUrl(
      asset.objectKey,
      asset.originalFileName,
      300,
      inline,
    );

    return {
      url,
      expiresIn: 300,
      fileName: asset.originalFileName,
    };
  }

  async deleteFile(
    clientId: string,
    fileId: string,
    actor?: IdentityContext,
  ): Promise<{ success: boolean; id: string; deletedAt: string }> {
    const agencyId = actor?.agencyId;
    const userId = actor?.userId;
    if (!agencyId || !userId) {
      throw new BadRequestException("Agency and user context required.");
    }

    assertClientScope(actor, clientId);

    const asset = await this.prisma.clientAnalyticsAsset.findFirst({
      where: {
        id: fileId,
        clientId,
        agencyId,
        deletedAt: null,
      },
    });

    if (!asset) {
      throw new NotFoundException("File not found or already deleted.");
    }

    const now = new Date();
    await this.prisma.clientAnalyticsAsset.update({
      where: { id: fileId },
      data: { deletedAt: now },
    });

    await this.eventBus.publish(DomainEvents.ClientAnalyticsAssetDeleted, {
      agencyId,
      actorId: userId,
      payload: {
        clientId,
        assetId: fileId,
        objectKey: asset.objectKey,
        deletedAt: now.toISOString(),
      },
    });

    return {
      success: true,
      id: fileId,
      deletedAt: now.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Report Notification Schedule CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getReportNotificationSchedule(
    clientId: string,
    actor?: IdentityContext,
  ): Promise<ReportNotificationScheduleResponse> {
    const agencyId = actor?.agencyId;
    if (!agencyId) {
      throw new BadRequestException("Agency context required.");
    }

    assertClientScope(actor, clientId);

    const schedule =
      await this.prisma.clientReportNotificationSchedule.findUnique({
        where: { agencyId_clientId: { agencyId, clientId } },
        include: {
          executions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

    if (!schedule) {
      return {
        configured: false,
        id: null,
        agencyId,
        clientId,
        frequency: ReportNotificationFrequency.MONTHLY,
        scheduleType: null,
        daysBeforeMonthEnd: null,
        weeklyDay: null,
        sendTime: null,
        timezone: "Asia/Kolkata",
        enabled: false,
        nextRunAt: null,
        lastRunAt: null,
        lastExecution: null,
      };
    }

    const frequency =
      schedule.frequency ?? ReportNotificationFrequency.MONTHLY;
    const scheduleType =
      schedule.scheduleType ?? ReportNotificationScheduleType.LAST_WORKING_DAY;
    const weeklyDay =
      frequency === ReportNotificationFrequency.WEEKLY
        ? (schedule.weeklyDay ?? null)
        : null;
    const lastExecution = schedule.executions[0] ?? null;
    const lastExecutionPeriod = lastExecution
      ? this.scheduleCalculator.resolveReportingPeriod({
          frequency,
          scheduleType,
          weeklyDay,
          runDate: lastExecution.scheduledAt,
          timezone: schedule.timezone,
        })
      : null;

    return {
      configured: true,
      id: schedule.id,
      agencyId: schedule.agencyId,
      clientId: schedule.clientId,
      frequency,
      scheduleType,
      daysBeforeMonthEnd: schedule.daysBeforeMonthEnd,
      weeklyDay,
      sendTime: schedule.sendTime,
      timezone: schedule.timezone,
      enabled: schedule.enabled,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt,
      lastExecution: lastExecution
        ? {
            id: lastExecution.id,
            status: lastExecution.status,
            reportYear: lastExecution.reportYear,
            reportMonth: lastExecution.reportMonth,
            reportPeriodLabel:
              lastExecutionPeriod?.label ??
              `${MONTH_NAMES[lastExecution.reportMonth - 1]} ${lastExecution.reportYear}`,
            periodStart:
              lastExecution.periodStart ??
              lastExecutionPeriod?.periodStart ??
              null,
            periodEnd:
              lastExecution.periodEnd ?? lastExecutionPeriod?.periodEnd ?? null,
            scheduledAt: lastExecution.scheduledAt,
            sentAt: lastExecution.sentAt,
            attemptCount: lastExecution.attemptCount,
            lastAttemptAt: lastExecution.lastAttemptAt,
            recipientCount: lastExecution.recipientCount,
            errorDetails: lastExecution.errorDetails,
          }
        : null,
    };
  }

  async upsertReportNotificationSchedule(
    clientId: string,
    dto: UpsertReportNotificationScheduleDto,
    actor?: IdentityContext,
  ): Promise<ReportNotificationScheduleResponse> {
    const agencyId = actor?.agencyId;
    const userId = actor?.userId;
    if (!agencyId || !userId) {
      throw new BadRequestException("Agency and user context required.");
    }

    // Client-scoped members may NOT configure agency notification schedules.
    if (actor?.clientId) {
      throw new ForbiddenException(
        "Client-scoped users cannot modify report notification schedules.",
      );
    }

    assertClientScope(actor, clientId);

    const normalized = this.normalizeReportNotificationInput(dto);
    this.scheduleCalculator.validateScheduleConfig(normalized);

    const timezone = this.scheduleCalculator.normalizeTimezone(dto.timezone);
    const enabled = dto.enabled !== false;

    const nextRunAt = enabled
      ? this.scheduleCalculator.calculateNextRunAt(normalized)
      : null;

    await this.prisma.clientReportNotificationSchedule.upsert({
      where: { agencyId_clientId: { agencyId, clientId } },
      create: {
        agencyId,
        clientId,
        frequency: normalized.frequency,
        scheduleType:
          normalized.scheduleType ??
          ReportNotificationScheduleType.LAST_WORKING_DAY,
        daysBeforeMonthEnd:
          normalized.frequency === ReportNotificationFrequency.MONTHLY &&
          normalized.scheduleType ===
          ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END
            ? (normalized.daysBeforeMonthEnd ?? null)
            : null,
        weeklyDay:
          normalized.frequency === ReportNotificationFrequency.WEEKLY
            ? normalized.weeklyDay
            : null,
        sendTime: normalized.sendTime,
        timezone,
        enabled,
        nextRunAt,
        createdById: userId,
      },
      update: {
        frequency: normalized.frequency,
        scheduleType:
          normalized.scheduleType ??
          ReportNotificationScheduleType.LAST_WORKING_DAY,
        daysBeforeMonthEnd:
          normalized.frequency === ReportNotificationFrequency.MONTHLY &&
          normalized.scheduleType ===
          ReportNotificationScheduleType.DAYS_BEFORE_MONTH_END
            ? (normalized.daysBeforeMonthEnd ?? null)
            : null,
        weeklyDay:
          normalized.frequency === ReportNotificationFrequency.WEEKLY
            ? normalized.weeklyDay
            : null,
        sendTime: normalized.sendTime,
        timezone,
        enabled,
        nextRunAt,
        version: { increment: 1 },
      },
    });

    return this.getReportNotificationSchedule(clientId, actor);
  }

  async previewReportNotificationSchedule(dto: PreviewReportNotificationScheduleDto) {
    const normalized = this.normalizeReportNotificationInput(dto);
    this.scheduleCalculator.validateScheduleConfig(normalized);
    return this.scheduleCalculator.generatePreview(normalized);
  }

  private normalizeReportNotificationInput(
    dto:
      | PreviewReportNotificationScheduleDto
      | UpsertReportNotificationScheduleDto,
  ) {
    const frequency = dto.frequency ?? ReportNotificationFrequency.MONTHLY;
    const timezone = this.scheduleCalculator.normalizeTimezone(dto.timezone);
    return {
      frequency,
      scheduleType:
        frequency === ReportNotificationFrequency.MONTHLY
          ? (dto.scheduleType ?? null)
          : null,
      weeklyDay:
        frequency === ReportNotificationFrequency.WEEKLY
          ? (dto.weeklyDay ?? null)
          : null,
      daysBeforeMonthEnd: dto.daysBeforeMonthEnd ?? null,
      sendTime: dto.sendTime,
      timezone,
    };
  }
}
