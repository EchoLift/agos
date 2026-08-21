import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AnalyticsFileCategory } from "@prisma/client";
import * as crypto from "crypto";

export interface BuildKeyOptions {
  agencyId: string;
  clientId: string;
  year: number;
  month: number;
  category: AnalyticsFileCategory;
  fileName: string;
}

export interface UploadObjectOptions {
  key: string;
  body: Buffer;
  contentType: string;
}

const CATEGORY_FOLDER_MAP: Record<AnalyticsFileCategory, string> = {
  [AnalyticsFileCategory.IMAGE]: "images",
  [AnalyticsFileCategory.VIDEO]: "videos",
  [AnalyticsFileCategory.PDF]: "pdfs",
  [AnalyticsFileCategory.SPREADSHEET]: "spreadsheets",
  [AnalyticsFileCategory.DOCUMENT]: "documents",
  [AnalyticsFileCategory.OTHER]: "other",
};

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket =
      this.config.get<string>("R2_BUCKET_NAME") || "agencie-client-analytics";

    const endpoint = this.config.get<string>("R2_ENDPOINT");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID") || "";
    const secretAccessKey =
      this.config.get<string>("R2_SECRET_ACCESS_KEY") || "";
    const region = this.config.get<string>("R2_REGION") || "auto";

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  sanitizeFileName(fileName: string): string {
    if (!fileName) return "unnamed-file";

    // Strip path components
    const baseName = fileName.replace(/^.*[\\/]/, "");
    const lastDot = baseName.lastIndexOf(".");

    let namePart = lastDot > 0 ? baseName.substring(0, lastDot) : baseName;
    const extPart = lastDot > 0 ? baseName.substring(lastDot + 1).toLowerCase() : "";

    // Normalize name: replace non-alphanumeric chars (except hyphens/underscores) with hyphens
    namePart = namePart
      .normalize("NFKD")
      .replace(/[^\w.-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!namePart) namePart = "file";
    if (namePart.length > 80) namePart = namePart.substring(0, 80);

    return extPart ? `${namePart}.${extPart}` : namePart;
  }

  buildClientAnalyticsKey(options: BuildKeyOptions): string {
    const { agencyId, clientId, year, month, category, fileName } = options;
    const paddedMonth = String(month).padStart(2, "0");
    const categoryFolder = CATEGORY_FOLDER_MAP[category] || "other";
    const safeName = this.sanitizeFileName(fileName);
    const uuid = crypto.randomUUID();

    return `agencies/${agencyId}/clients/${clientId}/${year}/${paddedMonth}/${categoryFolder}/${uuid}-${safeName}`;
  }

  async uploadObject(options: UploadObjectOptions): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          Body: options.body,
          ContentType: options.contentType,
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to upload object to R2 at key ${options.key}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerErrorException(
        "Failed to upload file to storage.",
      );
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to delete object from R2 at key ${key}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Non-fatal logging for cleanup routines
    }
  }

  async getSignedDownloadUrl(
    key: string,
    originalFileName: string,
    expiresInSeconds = 300,
    inline = false,
  ): Promise<string> {
    try {
      const safeName = this.sanitizeFileName(originalFileName);
      const dispositionType = inline ? "inline" : "attachment";
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `${dispositionType}; filename="${safeName}"`,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to generate signed download URL for key ${key}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerErrorException(
        "Failed to generate secure access URL.",
      );
    }
  }
}
