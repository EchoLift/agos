export function formatLabel(value?: string | null) {
  if (!value) return "—";

  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function statusPillClass(value?: string | null) {
  const status = (value ?? "").toUpperCase();
  const tone = statusTone(status);

  const colors: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-300",
    danger: "bg-red-500/15 text-red-300",
    warning: "bg-amber-500/15 text-amber-300",
    info: "bg-sky-500/15 text-sky-300",
    progress: "bg-blue-500/15 text-blue-400",
    neutral: "bg-zinc-800 text-zinc-300",
    violet: "bg-violet-500/15 text-violet-300",
  };

  return colors[tone];
}

export function statusPillBase(size: "xs" | "sm" = "xs") {
  return `inline-flex shrink-0 items-center rounded-full font-semibold leading-tight ${
    size === "sm" ? "px-3 py-1 text-xs" : "px-2 py-1 text-[11px]"
  }`;
}

export function statusPillClasses(value?: string | null, size: "xs" | "sm" = "xs") {
  return `${statusPillBase(size)} ${statusPillClass(value)}`;
}

export function statusTone(status: string) {
  if (["ACTIVE", "APPROVED", "PUBLISHED", "COMPLETED", "READY", "READY_TO_PUBLISH", "ON_TRACK", "RESOLVED"].includes(status)) {
    return "success";
  }

  if (["BLOCKED", "OVERDUE", "MISSED", "CANCELLED", "REJECTED", "FAILED", "INACTIVE"].includes(status)) {
    return "danger";
  }

  if (
    [
      "DRAFT",
      "PAUSED",
      "WAITING_REVIEW",
      "WAITING_APPROVAL",
      "WAITING_HANDOFF_ACCEPTANCE",
      "NEEDS_ATTENTION",
      "AT_RISK",
      "CLIENT_APPROVAL",
      "MANAGER_SCRIPT_REVIEW",
      "MANAGER_EDIT_REVIEW",
      "REVIEW",
      "APPROVAL",
      "CHANGES_REQUESTED",
    ].includes(status)
  ) {
    return "warning";
  }

  if (["SCHEDULED", "PLANNED", "PUBLISHING", "SHOOT", "EDITOR_INTAKE"].includes(status)) {
    return "info";
  }

  if (["IN_PROGRESS", "WRITING", "EDITING", "SUBMITTED", "FOOTAGE_SUBMITTED", "ASSIGNED"].includes(status)) {
    return "progress";
  }

  if (["ARCHIVED", "IDEA", "UNLINKED", "NOT_STARTED", "PENDING", "NO_SUBMISSION"].includes(status)) {
    return "neutral";
  }

  return "violet";
}
