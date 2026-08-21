import { apiClient } from "../api-client";

export type AnalyticsCategory =
  | "IMAGE"
  | "VIDEO"
  | "PDF"
  | "SPREADSHEET"
  | "DOCUMENT"
  | "OTHER";

export interface AnalyticsPeriod {
  year: number;
  month: number;
  label: string;
}

export interface AnalyticsFileItem {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  category: AnalyticsCategory;
  year: number;
  month: number;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name: string | null;
  } | null;
}

export interface AnalyticsCategoryGroup {
  category: AnalyticsCategory;
  label: string;
  count: number;
  files: AnalyticsFileItem[];
}

export interface GroupedAnalyticsResponse {
  period: AnalyticsPeriod;
  totalFiles: number;
  groups: AnalyticsCategoryGroup[];
}

export interface UploadAnalyticsGroupSummary {
  category: AnalyticsCategory;
  label: string;
  count: number;
}

export interface UploadFailureItem {
  fileName: string;
  code: string;
  message: string;
}

export interface UploadAnalyticsResponse {
  uploaded: number;
  failed: number;
  period: AnalyticsPeriod;
  groups: UploadAnalyticsGroupSummary[];
  failures: UploadFailureItem[];
}

export interface SignedDownloadResponse {
  url: string;
  expiresIn: number;
  fileName: string;
}

export async function getGroupedAnalyticsFiles(
  agencyId: string | null | undefined,
  clientId: string,
  period?: { year?: number; month?: number },
): Promise<GroupedAnalyticsResponse> {
  const queryParams = new URLSearchParams();
  if (period?.year) queryParams.set("year", String(period.year));
  if (period?.month) queryParams.set("month", String(period.month));

  const queryString = queryParams.toString();
  const endpoint = `/clients/${clientId}/analytics/files${queryString ? `?${queryString}` : ""}`;

  return apiClient<GroupedAnalyticsResponse>(endpoint, {
    method: "GET",
    agencyId: agencyId || undefined,
  });
}

export async function uploadAnalyticsFiles(
  agencyId: string | null | undefined,
  clientId: string,
  files: File[],
  period?: { year?: number; month?: number },
): Promise<UploadAnalyticsResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (period?.year) formData.append("year", String(period.year));
  if (period?.month) formData.append("month", String(period.month));

  return apiClient<UploadAnalyticsResponse>(
    `/clients/${clientId}/analytics/files`,
    {
      method: "POST",
      agencyId: agencyId || undefined,
      body: formData,
    },
  );
}

export async function getAnalyticsFileDownloadUrl(
  agencyId: string | null | undefined,
  clientId: string,
  fileId: string,
  inline = false,
): Promise<SignedDownloadResponse> {
  return apiClient<SignedDownloadResponse>(
    `/clients/${clientId}/analytics/files/${fileId}/download${inline ? "?inline=true" : ""}`,
    {
      method: "GET",
      agencyId: agencyId || undefined,
    },
  );
}

export async function deleteAnalyticsFile(
  agencyId: string | null | undefined,
  clientId: string,
  fileId: string,
): Promise<{ success: boolean; id: string; deletedAt: string }> {
  return apiClient<{ success: boolean; id: string; deletedAt: string }>(
    `/clients/${clientId}/analytics/files/${fileId}`,
    {
      method: "DELETE",
      agencyId: agencyId || undefined,
    },
  );
}

