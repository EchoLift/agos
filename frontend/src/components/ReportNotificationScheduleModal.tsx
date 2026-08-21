"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReportNotificationScheduleType,
  UpsertReportSchedulePayload,
  getReportNotificationSchedule,
  upsertReportNotificationSchedule,
  previewReportNotificationSchedule,
} from "@/lib/api/client-analytics";

// ─── Inline SVG Icons ───────────────────────────────────────────────────────

function IconBell({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS: {
  type: ReportNotificationScheduleType;
  label: string;
  description: string;
  reportPeriodHint: string;
  recommended?: boolean;
}[] = [
  {
    type: "FIRST_DAY",
    label: "First day of every month",
    description: "Notify about the previous month's reports.",
    reportPeriodHint: "Previous month",
  },
  {
    type: "FIRST_WORKING_DAY",
    label: "First working day of every month",
    description: "Notify about the previous month's reports.",
    reportPeriodHint: "Previous month",
  },
  {
    type: "LAST_DAY",
    label: "Last day of every month",
    description: "Notify about the current month's reports.",
    reportPeriodHint: "Current month",
  },
  {
    type: "LAST_WORKING_DAY",
    label: "Last working day of every month",
    description: "Notify about the current month's reports.",
    reportPeriodHint: "Current month",
    recommended: true,
  },
  {
    type: "DAYS_BEFORE_MONTH_END",
    label: "Before the end of every month",
    description: "Notify about the current month's reports.",
    reportPeriodHint: "Current month",
  },
];

const DAYS_BEFORE_OPTIONS = [1, 2, 3, 5, 7];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India - Asia/Kolkata" },
  { value: "Asia/Calcutta", label: "India - Asia/Calcutta" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Dubai", label: "Dubai - Asia/Dubai" },
  { value: "Asia/Singapore", label: "Singapore - Asia/Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo - Asia/Tokyo" },
  { value: "Asia/Bangkok", label: "Bangkok - Asia/Bangkok" },
  { value: "Asia/Hong_Kong", label: "Hong Kong - Asia/Hong_Kong" },
  { value: "Europe/London", label: "London - Europe/London" },
  { value: "Europe/Paris", label: "Paris - Europe/Paris" },
  { value: "America/New_York", label: "New York - America/New_York" },
  { value: "America/Chicago", label: "Chicago - America/Chicago" },
  { value: "America/Denver", label: "Denver - America/Denver" },
  { value: "America/Los_Angeles", label: "Los Angeles - America/Los_Angeles" },
  { value: "Australia/Sydney", label: "Sydney - Australia/Sydney" },
];

const modalInputClass =
  "date-input w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClass =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ReportNotificationScheduleModalProps {
  agencyId: string;
  clientId: string;
  clientName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReportNotificationScheduleModal({
  agencyId,
  clientId,
  clientName,
  isOpen,
  onClose,
  onSaved,
}: ReportNotificationScheduleModalProps) {
  const queryClient = useQueryClient();

  // Load existing schedule
  const scheduleQuery = useQuery({
    queryKey: ["report-notification-schedule", agencyId, clientId],
    queryFn: () => getReportNotificationSchedule(agencyId, clientId),
    enabled: isOpen && Boolean(agencyId && clientId),
    staleTime: 30_000,
  });

  const schedule = scheduleQuery.data ?? null;

  // Form state
  const [scheduleType, setScheduleType] =
    useState<ReportNotificationScheduleType>("LAST_WORKING_DAY");
  const [daysBeforeMonthEnd, setDaysBeforeMonthEnd] = useState<number>(3);
  const [sendTime, setSendTime] = useState("10:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [enabled, setEnabled] = useState(true);
  const [previewResult, setPreviewResult] = useState<{
    nextRunAt: string;
    reportPeriodLabel: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timezoneOptions = TIMEZONE_OPTIONS.some(
    (option) => option.value === timezone,
  )
    ? TIMEZONE_OPTIONS
    : [{ value: timezone, label: timezone }, ...TIMEZONE_OPTIONS];

  // Sync existing schedule into form when modal opens
  /* eslint-disable react-hooks/set-state-in-effect -- Modal form fields intentionally mirror the fetched schedule whenever the dialog opens. */
  useEffect(() => {
    if (!isOpen) return;
    if (schedule?.configured && schedule.scheduleType) {
      setScheduleType(schedule.scheduleType);
      setDaysBeforeMonthEnd(schedule.daysBeforeMonthEnd ?? 3);
      setSendTime(schedule.sendTime ?? "10:00");
      setTimezone(schedule.timezone ?? "Asia/Kolkata");
      setEnabled(schedule.enabled);
    } else {
      setScheduleType("LAST_WORKING_DAY");
      setDaysBeforeMonthEnd(3);
      setSendTime("10:00");
      // Attempt to default to browser/client timezone
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(browserTz || "Asia/Kolkata");
      setEnabled(true);
    }
    setPreviewResult(null);
    setPreviewError(null);
    setSaveError(null);
  }, [
    isOpen,
    schedule?.configured,
    schedule?.daysBeforeMonthEnd,
    schedule?.enabled,
    schedule?.scheduleType,
    schedule?.sendTime,
    schedule?.timezone,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch preview whenever form fields change
  const fetchPreview = useCallback(async () => {
    if (!agencyId || !clientId) return;
    setPreviewError(null);
    try {
      const payload: Omit<UpsertReportSchedulePayload, "enabled"> = {
        scheduleType,
        sendTime,
        timezone,
        ...(scheduleType === "DAYS_BEFORE_MONTH_END" && { daysBeforeMonthEnd }),
      };
      const result = await previewReportNotificationSchedule(
        agencyId,
        clientId,
        payload,
      );
      setPreviewResult({
        nextRunAt: result.nextRunAt,
        reportPeriodLabel: result.reportPeriodLabel,
      });
    } catch (err: unknown) {
      setPreviewError(getErrorMessage(err, "Unable to compute preview."));
      setPreviewResult(null);
    }
  }, [
    agencyId,
    clientId,
    scheduleType,
    daysBeforeMonthEnd,
    sendTime,
    timezone,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(fetchPreview, 400);
    return () => clearTimeout(timeout);
  }, [isOpen, fetchPreview]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: UpsertReportSchedulePayload) =>
      upsertReportNotificationSchedule(agencyId, clientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["report-notification-schedule", agencyId, clientId],
      });
      onSaved?.();
      onClose();
    },
    onError: (err: unknown) => {
      setSaveError(getErrorMessage(err, "Failed to save schedule."));
    },
  });

  const handleSave = () => {
    setSaveError(null);
    const payload: UpsertReportSchedulePayload = {
      scheduleType,
      sendTime,
      timezone,
      enabled,
      ...(scheduleType === "DAYS_BEFORE_MONTH_END" && { daysBeforeMonthEnd }),
    };
    saveMutation.mutate(payload);
  };

  // Format a UTC ISO string to local readable format
  const formatNextRun = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-IN", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-notification-title"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-primary">
                <IconBell className="h-5 w-5" />
              </span>
              <h3
                id="report-notification-title"
                className="text-base font-semibold text-foreground"
              >
                Monthly report notifications
              </h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Automatically notify{" "}
              <span className="font-medium text-foreground">
                {clientName || "this client"}
              </span>{" "}
              when their monthly reports are ready.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="ml-4 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close report notification schedule"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-5">
            {/* Schedule Options */}
            <div
              className="space-y-2"
              role="radiogroup"
              aria-label="Monthly report notification schedule"
            >
              {SCHEDULE_OPTIONS.map((opt) => (
                <ScheduleOptionButton
                  key={opt.type}
                  option={opt}
                  selected={scheduleType === opt.type}
                  onSelect={() => setScheduleType(opt.type)}
                />
              ))}
            </div>

            {/* Days before month end selector */}
            {scheduleType === "DAYS_BEFORE_MONTH_END" && (
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Days before month end
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_BEFORE_OPTIONS.map((d) => {
                    const selected = daysBeforeMonthEnd === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysBeforeMonthEnd(d)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {d} day{d !== 1 ? "s" : ""} before
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time + Timezone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="send-time"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Send at
                </label>
                <input
                  id="send-time"
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                  className={modalInputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="timezone"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={modalInputClass}
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Enable notifications
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  When disabled, no notifications will be sent even if due.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover ${
                  enabled
                    ? "border-primary bg-primary"
                    : "border-border bg-muted hover:bg-accent"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow transition-transform ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <IconCalendar className="h-3.5 w-3.5 text-primary" />
                Next notification
              </div>
              {previewError ? (
                <p className="mt-2 text-xs text-destructive">{previewError}</p>
              ) : previewResult ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {formatNextRun(previewResult.nextRunAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reporting period:{" "}
                    <span className="font-medium text-foreground">
                      {previewResult.reportPeriodLabel}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Computing…</p>
              )}
            </div>

            {saveError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                {saveError}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className={primaryButtonClass}
          >
            {saveMutation.isPending ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleOptionButton({
  option,
  selected,
  onSelect,
}: {
  option: {
    type: ReportNotificationScheduleType;
    label: string;
    description: string;
    recommended?: boolean;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
            selected ? "border-primary bg-primary" : "border-border bg-card"
          }`}
          aria-hidden="true"
        >
          {selected && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {option.label}
            </span>
            {option.recommended && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Recommended
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {option.description}
          </span>
        </span>
      </div>
    </button>
  );
}

// ─── Status Widget (embedded in Analytics Files header) ─────────────────────

interface ReportNotificationStatusProps {
  agencyId: string;
  clientId: string;
  canConfigure: boolean;
}

const SCHEDULE_TYPE_LABELS: Record<ReportNotificationScheduleType, string> = {
  FIRST_DAY: "First day of every month",
  FIRST_WORKING_DAY: "First working day of every month",
  LAST_DAY: "Last day of every month",
  LAST_WORKING_DAY: "Last working day of every month",
  DAYS_BEFORE_MONTH_END: "Before month end",
};

const EXECUTION_STATUS_LABELS: Record<string, { text: string; color: string }> =
  {
    SENT: { text: "Sent", color: "text-primary" },
    SKIPPED_NO_REPORTS: {
      text: "Notification skipped",
      color: "text-muted-foreground",
    },
    FAILED: { text: "Failed", color: "text-destructive" },
    PENDING: { text: "In progress", color: "text-primary" },
  };

export function ReportNotificationStatusWidget({
  agencyId,
  clientId,
  canConfigure,
}: ReportNotificationStatusProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: schedule } = useQuery({
    queryKey: ["report-notification-schedule", agencyId, clientId],
    queryFn: () => getReportNotificationSchedule(agencyId, clientId),
    enabled: Boolean(agencyId && clientId),
    staleTime: 60_000,
  });

  const formatNextRun = (iso: string, tz: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", {
        timeZone: tz,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const lastExec = schedule?.lastExecution;
  const execInfo = lastExec ? EXECUTION_STATUS_LABELS[lastExec.status] : null;

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="shrink-0 text-primary">
          <IconBell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            Report notifications
          </p>
          {!schedule?.configured ? (
            <p className="text-xs text-muted-foreground">Not configured</p>
          ) : !schedule.enabled ? (
            <p className="text-xs text-muted-foreground">Disabled</p>
          ) : (
            <div className="mt-0.5 space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                {SCHEDULE_TYPE_LABELS[schedule.scheduleType!]}
                {schedule.scheduleType === "DAYS_BEFORE_MONTH_END" &&
                  schedule.daysBeforeMonthEnd &&
                  ` (${schedule.daysBeforeMonthEnd} days before)`}
              </p>
              <p className="text-xs text-muted-foreground">
                {schedule.sendTime} · {schedule.timezone}
              </p>
              {schedule.nextRunAt && (
                <p className="text-xs text-primary">
                  Next: {formatNextRun(schedule.nextRunAt, schedule.timezone)}
                </p>
              )}
              {lastExec && execInfo && (
                <div className="space-y-0.5">
                  <p className={`text-xs ${execInfo.color}`}>
                    {lastExec.reportPeriodLabel}: {execInfo.text}
                  </p>
                  {lastExec.status === "SKIPPED_NO_REPORTS" && (
                    <p className="text-xs text-muted-foreground">
                      No reports were available at the scheduled time.
                    </p>
                  )}
                  {lastExec.status === "FAILED" && (
                    <p className="text-xs text-muted-foreground">
                      Attempted {lastExec.attemptCount} time
                      {lastExec.attemptCount === 1 ? "" : "s"}
                      {lastExec.errorDetails
                        ? `: ${lastExec.errorDetails}`
                        : "."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {canConfigure && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {schedule?.configured ? "Edit" : "Set schedule"}
          </button>
        )}
      </div>

      <ReportNotificationScheduleModal
        agencyId={agencyId}
        clientId={clientId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({
            queryKey: ["report-notification-schedule", agencyId, clientId],
          });
        }}
      />
    </>
  );
}
