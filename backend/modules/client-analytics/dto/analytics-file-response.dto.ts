import { AnalyticsFileCategory } from "@prisma/client";

export interface PeriodDto {
  year: number;
  month: number;
  label: string;
}

export interface CategoryCountDto {
  category: AnalyticsFileCategory;
  label: string;
  count: number;
}

export interface UploadFailureDto {
  fileName: string;
  code: string;
  message: string;
}

export interface UploadAnalyticsResponseDto {
  uploaded: number;
  failed: number;
  period: PeriodDto;
  groups: CategoryCountDto[];
  failures: UploadFailureDto[];
}

export interface AnalyticsAssetItemDto {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  category: AnalyticsFileCategory;
  year: number;
  month: number;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name: string | null;
  } | null;
}

export interface CategoryGroupDto {
  category: AnalyticsFileCategory;
  label: string;
  count: number;
  files: AnalyticsAssetItemDto[];
}

export interface GroupedAnalyticsFilesResponseDto {
  period: PeriodDto;
  totalFiles: number;
  groups: CategoryGroupDto[];
}

export interface SignedUrlResponseDto {
  url: string;
  expiresIn: number;
  fileName: string;
}
