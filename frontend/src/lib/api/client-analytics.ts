import { apiClient } from "../api-client";

export type AnalyticsCategory =
  "IMAGE" | "VIDEO" | "PDF" | "SPREADSHEET" | "DOCUMENT" | "OTHER";

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

// ─── Report Notification Schedule ──────────────────────────────────────────

export type ReportNotificationScheduleType =
  | "FIRST_DAY"
  | "FIRST_WORKING_DAY"
  | "LAST_DAY"
  | "LAST_WORKING_DAY"
  | "DAYS_BEFORE_MONTH_END";

export type ReportNotificationFrequency = "MONTHLY" | "WEEKLY";

export type ReportNotificationWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type ReportNotificationExecutionStatus =
  "PENDING" | "SENT" | "SKIPPED_NO_REPORTS" | "FAILED";

export interface ReportScheduleLastExecution {
  id: string;
  status: ReportNotificationExecutionStatus;
  reportYear: number;
  reportMonth: number;
  reportPeriodLabel: string;
  periodStart: string;
  periodEnd: string;
  scheduledAt: string;
  sentAt: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  recipientCount: number;
  errorDetails: string | null;
}

export interface ReportNotificationScheduleData {
  configured: boolean;
  id: string | null;
  agencyId: string;
  clientId: string;
  frequency: ReportNotificationFrequency;
  scheduleType: ReportNotificationScheduleType | null;
  daysBeforeMonthEnd: number | null;
  weeklyDay: ReportNotificationWeekday | null;
  sendTime: string | null;
  timezone: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastExecution: ReportScheduleLastExecution | null;
}

export interface UpsertReportSchedulePayload {
  frequency?: ReportNotificationFrequency;
  scheduleType?: ReportNotificationScheduleType;
  weeklyDay?: ReportNotificationWeekday;
  daysBeforeMonthEnd?: number;
  sendTime: string;
  timezone?: string;
  enabled?: boolean;
}

export interface ReportSchedulePreview {
  frequency: ReportNotificationFrequency;
  scheduleType: ReportNotificationScheduleType | null;
  weeklyDay: ReportNotificationWeekday | null;
  daysBeforeMonthEnd: number | null;
  sendTime: string;
  timezone: string;
  nextRunAt: string;
  reportYear: number;
  reportMonth: number;
  periodStart: string;
  periodEnd: string;
  reportPeriodLabel: string;
}

export interface ReportNotificationTestEmailResponse {
  success: boolean;
  recipientEmail: string;
  reportPeriodLabel: string;
  nextRunAt: string;
}

export async function getReportNotificationSchedule(
  agencyId: string | null | undefined,
  clientId: string,
): Promise<ReportNotificationScheduleData> {
  return apiClient<ReportNotificationScheduleData>(
    `/clients/${clientId}/analytics/files/notification-schedule`,
    {
      method: "GET",
      agencyId: agencyId || undefined,
    },
  );
}

export async function upsertReportNotificationSchedule(
  agencyId: string | null | undefined,
  clientId: string,
  payload: UpsertReportSchedulePayload,
): Promise<ReportNotificationScheduleData> {
  return apiClient<ReportNotificationScheduleData>(
    `/clients/${clientId}/analytics/files/notification-schedule`,
    {
      method: "PUT",
      agencyId: agencyId || undefined,
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function previewReportNotificationSchedule(
  agencyId: string | null | undefined,
  clientId: string,
  payload: Omit<UpsertReportSchedulePayload, "enabled">,
): Promise<ReportSchedulePreview> {
  return apiClient<ReportSchedulePreview>(
    `/clients/${clientId}/analytics/files/notification-schedule/preview`,
    {
      method: "POST",
      agencyId: agencyId || undefined,
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function sendReportNotificationTestEmail(
  agencyId: string | null | undefined,
  clientId: string,
  payload: Omit<UpsertReportSchedulePayload, "enabled">,
): Promise<ReportNotificationTestEmailResponse> {
  return apiClient<ReportNotificationTestEmailResponse>(
    `/clients/${clientId}/analytics/files/notification-schedule/test`,
    {
      method: "POST",
      agencyId: agencyId || undefined,
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}
