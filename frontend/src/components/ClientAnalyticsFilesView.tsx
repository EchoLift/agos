"use client";

import { useState, useMemo, type ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AnalyticsCategory,
  AnalyticsFileItem,
  deleteAnalyticsFile,
  getAnalyticsFileDownloadUrl,
  getGroupedAnalyticsFiles,
  uploadAnalyticsFiles,
} from "@/lib/api/client-analytics";
import { ReportNotificationStatusWidget } from "@/components/ReportNotificationScheduleModal";

interface ClientAnalyticsFilesViewProps {
  agencyId: string | null;
  clientId: string;
  clientName?: string;
  canUpload?: boolean;
  canDelete?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

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

// ── SVG icon components ──────────────────────────────────────────────────────

const IconImage = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);
const IconPdf = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 12v-1h4v1" />
    <path d="M12 12v4" />
    <path d="M10 16h4" />
  </svg>
);
const IconSpreadsheet = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
);
const IconDocument = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
const IconVideo = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m22 8-6 4 6 4V8z" />
    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
  </svg>
);
const IconBox = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconAnalytics = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconFolder = ({ className = "h-7 w-7" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconUpload = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconChevronLeft = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = ({
  className = "h-4 w-4",
}: {
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconX = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

type CategoryIconProps = { className?: string };
const CATEGORY_ICON: Record<
  AnalyticsCategory,
  (p: CategoryIconProps) => ReactElement
> = {
  IMAGE: IconImage,
  PDF: IconPdf,
  SPREADSHEET: IconSpreadsheet,
  DOCUMENT: IconDocument,
  VIDEO: IconVideo,
  OTHER: IconBox,
};

const CATEGORY_META: Record<
  AnalyticsCategory,
  { label: string; iconColor: string; badgeClass: string }
> = {
  IMAGE: {
    label: "Images",
    iconColor: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  PDF: {
    label: "PDF Reports",
    iconColor: "text-rose-400",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  SPREADSHEET: {
    label: "Spreadsheets",
    iconColor: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  DOCUMENT: {
    label: "Documents",
    iconColor: "text-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  VIDEO: {
    label: "Videos",
    iconColor: "text-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  OTHER: {
    label: "Other Files",
    iconColor: "text-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
};

export function ClientAnalyticsFilesView({
  agencyId,
  clientId,
  clientName,
  canUpload = true,
  canDelete = true,
  title,
  description,
  emptyMessage,
}: ClientAnalyticsFilesViewProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(
    currentDate.getUTCFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    currentDate.getUTCMonth() + 1,
  );

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [
      "client-analytics",
      agencyId,
      clientId,
      selectedYear,
      selectedMonth,
    ],
    queryFn: () =>
      getGroupedAnalyticsFiles(agencyId, clientId, {
        year: selectedYear,
        month: selectedMonth,
      }),
    enabled: Boolean(agencyId && clientId),
    staleTime: 30 * 1000,
  });

  const data = query.data ?? null;
  const isLoading = query.isLoading && !data;
  const error = query.error instanceof Error ? query.error.message : null;
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["client-analytics", agencyId, clientId],
    });

  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadFilesList, setUploadFilesList] = useState<File[]>([]);
  const [uploadYear, setUploadYear] = useState<number>(selectedYear);
  const [uploadMonth, setUploadMonth] = useState<number>(selectedMonth);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    successMessage?: string;
    failures?: Array<{ fileName: string; message: string }>;
  } | null>(null);

  // Action states
  const [activeDownloadingId, setActiveDownloadingId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const availableGroups = useMemo(
    () => (data?.groups ?? []).filter((g) => g.count > 0),
    [data?.groups],
  );

  const currentCategory = availableGroups.some(
    (g) => g.category === activeCategory,
  )
    ? activeCategory
    : "ALL";

  const displayedGroups = useMemo(() => {
    if (currentCategory === "ALL") {
      return availableGroups;
    }
    return availableGroups.filter((g) => g.category === currentCategory);
  }, [availableGroups, currentCategory]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrent = () => {
    const now = new Date();
    setSelectedYear(now.getUTCFullYear());
    setSelectedMonth(now.getUTCMonth() + 1);
  };

  const MAX_FILES = 20;
  const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
  const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const oversize = newFiles.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversize.length > 0) {
      setUploadFeedback({
        failures: oversize.map((f) => ({
          fileName: f.name,
          message: `Exceeds 25 MB limit (${formatBytes(f.size)}). Please reduce the file size before uploading.`,
        })),
      });
      // Still add the valid files so the user can see and remove them
      const valid = newFiles.filter((f) => f.size <= MAX_FILE_BYTES);
      setUploadFilesList((prev) => [...prev, ...valid]);
    } else {
      setUploadFilesList((prev) => [...prev, ...newFiles]);
      setUploadFeedback(null);
    }
    // Reset input so same file can be re-selected after removal
    e.target.value = "";
  };

  const removeFileFromUpload = (index: number) => {
    setUploadFilesList((prev) => prev.filter((_, i) => i !== index));
    setUploadFeedback(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFilesList.length === 0) return;

    // ── Client-side guard: size limits ──────────────────────────────
    const tooMany = uploadFilesList.length > MAX_FILES;
    const oversized = uploadFilesList.filter((f) => f.size > MAX_FILE_BYTES);
    const totalBytes = uploadFilesList.reduce((sum, f) => sum + f.size, 0);
    const totalExceeded = totalBytes > MAX_TOTAL_BYTES;

    if (tooMany || oversized.length > 0 || totalExceeded) {
      const failures: Array<{ fileName: string; message: string }> = [];
      if (tooMany)
        failures.push({
          fileName: "Batch",
          message: `Too many files selected (${uploadFilesList.length}). Maximum is ${MAX_FILES} files per upload.`,
        });
      oversized.forEach((f) =>
        failures.push({
          fileName: f.name,
          message: `File exceeds the 25 MB per-file limit (${formatBytes(f.size)}). Remove it before uploading.`,
        }),
      );
      if (totalExceeded)
        failures.push({
          fileName: "Total payload",
          message: `Combined size of ${formatBytes(totalBytes)} exceeds the 100 MB batch limit. Remove some files.`,
        });
      setUploadFeedback({ failures });
      return;
    }
    // ────────────────────────────────────────────────────────────────

    setIsUploading(true);
    setUploadFeedback(null);

    try {
      const res = await uploadAnalyticsFiles(
        agencyId,
        clientId,
        uploadFilesList,
        {
          year: uploadYear,
          month: uploadMonth,
        },
      );

      const groupSummaryText = res.groups
        .map((g) => `${g.count} ${g.label}`)
        .join(", ");

      const successMsg =
        res.uploaded > 0
          ? `Successfully uploaded ${res.uploaded} file${res.uploaded > 1 ? "s" : ""}${groupSummaryText ? ` (${groupSummaryText})` : ""}.`
          : undefined;

      setUploadFeedback({
        successMessage: successMsg,
        failures: res.failures,
      });

      if (res.uploaded > 0) {
        setUploadFilesList([]);
        // Sync selected month if user uploaded to another period
        setSelectedYear(uploadYear);
        setSelectedMonth(uploadMonth);
        refresh();
      }
    } catch (err: unknown) {
      setUploadFeedback({
        failures: [
          {
            fileName: "Upload",
            message:
              err instanceof Error ? err.message : "Failed to upload files.",
          },
        ],
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (file: AnalyticsFileItem, inline = false) => {
    try {
      setActiveDownloadingId(file.id);
      const res = await getAnalyticsFileDownloadUrl(
        agencyId,
        clientId,
        file.id,
        inline,
      );
      if (inline) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        const link = document.createElement("a");
        link.href = res.url;
        link.download = res.fileName || file.originalFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate access URL for file.",
      );
    } finally {
      setActiveDownloadingId(null);
    }
  };

  const handleDelete = async (file: AnalyticsFileItem) => {
    if (
      !confirm(
        `Are you sure you want to delete "${file.originalFileName}"? This action will archive the file.`,
      )
    ) {
      return;
    }

    try {
      setDeletingId(file.id);
      await deleteAnalyticsFile(agencyId, clientId, file.id);
      refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete file.");
    } finally {
      setDeletingId(null);
    }
  };

  const isCurrentMonth =
    selectedYear === currentDate.getUTCFullYear() &&
    selectedMonth === currentDate.getUTCMonth() + 1;

  const totalFiles = data?.totalFiles ?? 0;

  return (
    <div className="space-y-2 pb-24 md:pb-8">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
            <IconAnalytics className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                {title ? "Shared Files" : "Client Analytics Storage"}
              </p>
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {title ||
                data?.period.label ||
                `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
            </h2>
            <p className="text-xs text-zinc-400">
              {description ||
                `${totalFiles} file${totalFiles === 1 ? "" : "s"} stored for this reporting period.`}
            </p>
          </div>
        </div>

        {/* Period Switcher & Upload CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-zinc-800 bg-[#0b0b11] p-1 shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <IconChevronLeft />
            </button>
            <div className="px-3 text-xs font-semibold text-zinc-200">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <IconChevronRight />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleJumpToCurrent}
              className="rounded-full border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Current Month
            </button>
          )}

          {canUpload && (
            <button
              type="button"
              onClick={() => {
                setUploadYear(selectedYear);
                setUploadMonth(selectedMonth);
                setUploadFeedback(null);
                setIsUploadOpen(true);
              }}
              className="flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
            >
              <IconUpload className="h-4 w-4" /> Upload Files
            </button>
          )}
        </div>
      </div>

      {canUpload && agencyId && (
        <ReportNotificationStatusWidget
          agencyId={agencyId}
          clientId={clientId}
          canConfigure={canUpload}
        />
      )}

      {/* Content State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950/80 p-16 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="mt-4 text-sm text-zinc-400">
            Loading analytics files...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-400">
          <p className="font-semibold">Unable to load analytics files</p>
          <p className="mt-1 text-xs">{error}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-3 rounded-full border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
          >
            Retry
          </button>
        </div>
      ) : totalFiles === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-400/20 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-500">
            <IconFolder className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">
            No analytics files for {MONTH_NAMES[selectedMonth - 1]}{" "}
            {selectedYear}
          </h3>
          <p className="mt-2 max-w-md text-xs text-zinc-400">
            {emptyMessage ||
              (canUpload
                ? `Upload monthly platform performance screenshots, metrics spreadsheets, PDF summaries, and reports for ${clientName || "this client"}.`
                : "No analytics files were shared for this reporting period.")}
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={() => {
                setUploadYear(selectedYear);
                setUploadMonth(selectedMonth);
                setUploadFeedback(null);
                setIsUploadOpen(true);
              }}
              className="mt-6 rounded-full bg-indigo-500 px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              Upload Analytics Files
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Category Sub-Navigation Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setActiveCategory("ALL")}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition ${
                currentCategory === "ALL"
                  ? "border-indigo-500 bg-indigo-500/15 font-semibold text-white shadow-sm shadow-indigo-500/20"
                  : "border-zinc-800 bg-[#0b0b11] text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span>All</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  currentCategory === "ALL"
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {totalFiles}
              </span>
            </button>

            {availableGroups.map((group) => {
              const meta = CATEGORY_META[group.category] || CATEGORY_META.OTHER;
              const Icon = CATEGORY_ICON[group.category];
              const isActive = currentCategory === group.category;
              return (
                <button
                  key={group.category}
                  type="button"
                  onClick={() => setActiveCategory(group.category)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition ${
                    isActive
                      ? "border-indigo-500 bg-indigo-500/15 font-semibold text-white shadow-sm shadow-indigo-500/20"
                      : "border-zinc-800 bg-[#0b0b11] text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <span className={meta.iconColor}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{group.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-indigo-500 text-white"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {group.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grouped Category Sections */}
          <div className="space-y-2">
            {displayedGroups.map((group) => {
              const meta = CATEGORY_META[group.category] || CATEGORY_META.OTHER;
              return (
                <section
                  key={group.category}
                  className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 shadow-2xl shadow-black/20"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <div className="flex items-center gap-3">
                      <span className={meta.iconColor}>
                        {(() => {
                          const Icon = CATEGORY_ICON[group.category];
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </span>
                      <h3 className="text-base font-semibold text-white">
                        {group.label}
                      </h3>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                      >
                        {group.count}
                      </span>
                    </div>
                  </div>

                  {/* Group Files Grid */}
                  <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {group.files.map((file) => (
                      <div
                        key={file.id}
                        className="w-full min-w-0 max-w-full overflow-hidden group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-[#0b0b11] p-2 transition hover:border-zinc-700 hover:bg-zinc-900/60"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={meta.iconColor + " shrink-0"}>
                                {(() => {
                                  const Icon = CATEGORY_ICON[group.category];
                                  return <Icon className="h-4 w-4" />;
                                })()}
                              </span>
                              <div className="min-w-0">
                                <p
                                  className="min-w-0 truncate text-sm font-medium text-zinc-200 group-hover:text-white"
                                  title={file.originalFileName}
                                >
                                  {file.originalFileName}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span>{formatBytes(file.sizeBytes)}</span>
                            <span>•</span>
                            <span>
                              {new Date(file.createdAt).toLocaleDateString()}
                            </span>
                            {file.uploadedBy?.name && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[120px]">
                                  by {file.uploadedBy.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* File Action Buttons */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/60 pt-3">
                          <div className="flex items-center gap-1.5">
                            {/* Preview button for images & PDFs */}
                            {(file.category === "IMAGE" ||
                              file.category === "PDF") && (
                              <button
                                type="button"
                                onClick={() => handleDownload(file, true)}
                                disabled={activeDownloadingId === file.id}
                                className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                                title="Open inline preview in a new tab"
                              >
                                Preview
                              </button>
                            )}

                            {/* Download button */}
                            <button
                              type="button"
                              onClick={() => handleDownload(file, false)}
                              disabled={activeDownloadingId === file.id}
                              className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-indigo-400 transition hover:bg-indigo-950/50 hover:text-indigo-300 disabled:opacity-50"
                              title="Download original file"
                            >
                              {activeDownloadingId === file.id
                                ? "Preparing..."
                                : "Download"}
                            </button>
                          </div>

                          {/* Delete button (only if canDelete is true) */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(file)}
                              disabled={deletingId === file.id}
                              className="text-xs text-zinc-500 transition hover:text-rose-400 disabled:opacity-50"
                              title="Delete file"
                            >
                              {deletingId === file.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal (only rendered if canUpload is true) */}
      {canUpload && isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-[#0b0b11] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Upload Analytics Files
                </h3>
                <p className="text-xs text-zinc-400">
                  Mixed batch upload • Automatic server-side categorization
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadOpen(false);
                    setUploadFilesList([]);
                    setUploadFeedback(null);
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <IconX />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-5 space-y-5">
              {/* Reporting Period Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Reporting Month
                  </label>
                  <select
                    value={uploadMonth}
                    onChange={(e) => setUploadMonth(Number(e.target.value))}
                    disabled={isUploading}
                    className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Reporting Year
                  </label>
                  <input
                    type="number"
                    value={uploadYear}
                    onChange={(e) => setUploadYear(Number(e.target.value))}
                    min={2020}
                    max={2035}
                    disabled={isUploading}
                    className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Drag & Drop / File Input Zone */}
              <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-350/60 p-6 text-center transition hover:border-indigo-500/50">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="text-zinc-400">
                  <IconUpload className="h-8 w-8" />
                </span>
                <p className="mt-2 text-sm font-medium text-zinc-300">
                  Drag & drop analytics files here, or{" "}
                  <span className="text-indigo-400 underline">browse</span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Images, PDFs, Spreadsheets (CSV/XLSX), Docs, Videos • Up to 20
                  files (max 25MB each)
                </p>
              </div>

              {/* Selected Files Preview List */}
              {uploadFilesList.length > 0 &&
                (() => {
                  const totalBytes = uploadFilesList.reduce(
                    (s, f) => s + f.size,
                    0,
                  );
                  const totalOver = totalBytes > MAX_TOTAL_BYTES;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>
                          Selected Files ({uploadFilesList.length}/{MAX_FILES})
                          {" — "}
                          <span
                            className={
                              totalOver
                                ? "text-rose-400 font-semibold"
                                : "text-zinc-400"
                            }
                          >
                            {formatBytes(totalBytes)} / 100 MB total
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadFilesList([]);
                            setUploadFeedback(null);
                          }}
                          className="text-rose-400 hover:underline"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {uploadFilesList.map((file, idx) => {
                          const over = file.size > MAX_FILE_BYTES;
                          return (
                            <div
                              key={`${file.name}-${idx}`}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                                over
                                  ? "border-rose-500/40 bg-rose-950/40"
                                  : "border-zinc-800/80 bg-zinc-900/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                                <span
                                  className={`truncate ${over ? "text-rose-300" : "text-zinc-300"}`}
                                >
                                  {file.name}
                                </span>
                                <span
                                  className={`shrink-0 ${over ? "text-rose-400 font-semibold" : "text-zinc-500"}`}
                                >
                                  ({formatBytes(file.size)})
                                </span>
                                {over && (
                                  <span className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                                    &gt;25 MB
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFileFromUpload(idx)}
                                className="ml-2 shrink-0 text-zinc-500 hover:text-rose-400"
                              >
                                <IconX />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              {/* Feedback / Error Alerts */}
              {uploadFeedback?.successMessage && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                  {uploadFeedback.successMessage}
                </div>
              )}

              {uploadFeedback?.failures &&
                uploadFeedback.failures.length > 0 && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400 space-y-1">
                    <p className="font-semibold">
                      Some files could not be uploaded:
                    </p>
                    {uploadFeedback.failures.map((f, i) => (
                      <p key={i}>
                        • {f.fileName}: {f.message}
                      </p>
                    ))}
                  </div>
                )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="rounded-full border border-zinc-800 px-5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={uploadFilesList.length === 0 || isUploading}
                  className="flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 active:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isUploading ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>
                      Upload{" "}
                      {uploadFilesList.length > 0
                        ? `(${uploadFilesList.length})`
                        : ""}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
