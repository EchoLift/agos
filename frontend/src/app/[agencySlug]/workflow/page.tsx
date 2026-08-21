"use client";

import { Dispatch, ReactNode, SetStateAction, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useAgency } from "@/components/AgencyProvider";
import { performWorkflowAction, WorkflowActionType, WorkflowBoardItem } from "@/lib/api/workflow";
import { parseApiError, ParsedApiError } from "@/lib/api-error";
import { formatLabel, statusPillClass, statusPillClasses } from "@/lib/status-style";
import { getAgencyRoleKeys } from "@/lib/workspace-access";
import { invalidateWorkspaceQueries, queryKeys, useWorkflowQuery } from "@/lib/query";
import { getHelpHref } from "@/lib/workspace-url";
import { getWorkspaceHref } from "@/lib/workspace-url";
import { rememberedEntityKey, useRememberLastVisitedEntity } from "@/lib/remembered-tab";
import { useDialog } from "@/components/ui/DialogProvider";
const riskOptions = ["ON_TRACK", "NEEDS_ATTENTION", "AT_RISK", "BLOCKED", "OVERDUE"];

export default function WorkflowPage() {
  const { agencyId, agency } = useAgency();
  const router = useRouter();
  const dialog = useDialog();
  const queryClient = useQueryClient();
  const safeAgencySlug = agency?.slug ?? "";
  const roleKeys = useMemo(() => getAgencyRoleKeys(agency), [agency]);
  const currentMembershipId = agency?.membershipId ?? null;
  const [selectedItem, setSelectedItem] = useState<WorkflowBoardItem | null>(null);
  useRememberLastVisitedEntity({
    storageKey: rememberedEntityKey("workflow", agencyId),
    entityId: selectedItem?.contentAssetId,
    enabled: Boolean(selectedItem),
  });
  const [mobileStage, setMobileStage] = useState("");
  const [filters, setFilters] = useState({ clientId: "", campaignId: "", ownerId: "", risk: "", search: "" });
  const [actionDraft, setActionDraft] = useState({ externalLink: "", comment: "", reason: "" });
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [actionError, setActionError] = useState<ParsedApiError | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boardQuery = useWorkflowQuery(agencyId, filters);
  const board = boardQuery.data ?? null;
  const isLoading = boardQuery.isLoading && !board;
  const firstLoadError = !board && boardQuery.error
    ? boardQuery.error instanceof Error
      ? boardQuery.error.message
      : "Failed to load workflow board."
    : null;
  const selectItem = (item: WorkflowBoardItem | null) => {
    setSelectedItem(item);
    setActionDraft({ externalLink: "", comment: "", reason: "" });
    setActionError(null);
    setError(null);
  };

  const runWorkflowAction = async (
    action: WorkflowActionType,
    allowMissingAssignee = false,
  ) => {
    if (!agencyId || !selectedItem) return;
    setIsActionRunning(true);
    setActionError(null);
    setError(null);

    const trimmedLink = actionDraft.externalLink.trim();
    const trimmedComment = actionDraft.comment.trim();
    const trimmedReason = actionDraft.reason.trim();
    const targetId = selectedItem.workflowTaskId ?? selectedItem.contentAssetId;
    const now = new Date().getTime();
    const idempotencyKey = `${action}:${targetId}:${now}`;

    try {
      await performWorkflowAction(agencyId, selectedItem.contentAssetId, {
        action,
        idempotencyKey,
        ...(trimmedLink
          ? { externalLink: trimmedLink }
          : {}),
        ...(trimmedComment ? { comment: trimmedComment } : {}),
        ...(trimmedReason ? { reason: trimmedReason } : {}),
        ...(allowMissingAssignee
          ? { allowMissingAssignee: true }
          : {}),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.contentAsset(agencyId, selectedItem.contentAssetId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaignContent(agencyId, selectedItem.campaignId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(agencyId, selectedItem.campaignId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publishingSchedules(
          agencyId,
          selectedItem.campaignId,
        ),
      });
      invalidateWorkspaceQueries(queryClient, agencyId, [
        "workflow",
        "dashboard",
        "calendar",
        "content",
        "campaigns",
        "gigs",
      ]);
      const refreshed = await boardQuery.refetch();

      const nextSelected = refreshed.data?.columns.flatMap((column) => column.items).find((item) => item.contentAssetId === selectedItem.contentAssetId) ?? null;
      selectItem(nextSelected);
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      const isMissingAssignee =
        action === "APPROVE" &&
        /Assign a .* before approving|Assign an .* before/i.test(parsed.message);
      if (isMissingAssignee && !allowMissingAssignee) {
        const confirmed = await dialog.confirm({
          title: "Approve without Next Assignee?",
          description: `${parsed.message}. The workflow will pause in the next stage until an assignee is selected.`,
          confirmText: "Approve anyway",
          cancelText: "Cancel",
          variant: "warning",
        });
        if (confirmed) {
          setIsActionRunning(false);
          await runWorkflowAction(action, true);
          return;
        }
      }

      if (parsed.isCampaignReviewAccessRequired) {
        const managerName = parsed.currentCampaignManager?.name;
        const suggestion =
          parsed.suggestion ||
          (managerName
            ? `Ask to be added as a campaign manager or reviewer, or contact ${managerName}.`
            : "Ask to be added as a campaign manager or reviewer, or contact the current campaign manager.");

        await dialog.alert({
          title: "Approval access required",
          variant: "error",
          description: (
            <div className="space-y-2 text-sm text-zinc-300">
              <p>You don&apos;t have approval access for this campaign.</p>
              {managerName ? (
                <p className="font-medium text-white">
                  Current campaign manager: <span className="text-indigo-400">{managerName}</span>
                </p>
              ) : null}
              <p className="text-xs text-zinc-400">{suggestion}</p>
            </div>
          ),
          confirmText: "Understood",
        });
      } else if (parsed.isForbidden) {
        await dialog.alert({
          title: "Permission denied",
          variant: "error",
          description: parsed.message || "You don't have permission to perform this action.",
          confirmText: "Understood",
        });
      }

      setActionError(parsed);
      setError(parsed.message);
    } finally {
      setIsActionRunning(false);
    }
  };

  const filterOptions = useMemo(() => {
    const items = board?.columns.flatMap((column) => column.items) ?? [];
    return {
      clients: uniqueBy(items.map((item) => ({ id: item.clientId, label: item.clientName }))),
      campaigns: uniqueBy(items.map((item) => ({ id: item.campaignId, label: item.campaignName }))),
      owners: uniqueBy(items.flatMap((item) => (item.owner ? [{ id: item.owner.membershipId, label: item.owner.name }] : []))),
    };
  }, [board]);

  const hasItems = board?.columns.some((column) => column.items.length > 0);
  const defaultMobileStage = board?.columns.find((column) => column.items.length > 0)?.stage
    ?? board?.columns[0]?.stage
    ?? "";
  const effectiveMobileStage = board?.columns.some((column) => column.stage === mobileStage)
    ? mobileStage
    : defaultMobileStage;
  const mobileColumn = board?.columns.find((column) => column.stage === effectiveMobileStage)
    ?? board?.columns.find((column) => column.items.length > 0)
    ?? board?.columns[0];

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3 lg:gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl lg:mt-2">Workflow</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            What is moving, what is stuck, who owns it, and what should happen next.
          </p>
          <Link href={getHelpHref("daily-operations/workflow")} className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            Understand the production workflow
          </Link>
        </div>
        <div className="hidden rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-400 lg:block">Board view</div>
      </div>

      <div className="grid grid-cols-5 gap-1 sm:grid-cols-5 lg:gap-1">
        <SummaryCard label="Active" value={board?.summary.active ?? 0} />
        <SummaryCard label="Review" value={board?.summary.waitingReview ?? 0} />
        <SummaryCard label="Blocked" value={board?.summary.blocked ?? 0} tone="danger" />
        <SummaryCard label="Overdue" value={board?.summary.overdue ?? 0} tone="danger" />
        <SummaryCard label="Due Today" value={board?.summary.dueToday ?? 0} tone="attention" />
      </div>

      <details className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-0 lg:hidden">
        <summary className="min-h-8 cursor-pointer p-2 text-sm font-semibold text-zinc-300">Search and filters</summary>
        <div className="grid gap-1 p-1">
          <WorkflowFilters filters={filters} setFilters={setFilters} options={filterOptions} />
        </div>
      </details>

      <div className="hidden rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20 lg:block">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search code, client, campaign"
            className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-span-2"
          />
          <FilterSelect label="All clients" value={filters.clientId} onChange={(value) => setFilters((current) => ({ ...current, clientId: value }))} options={filterOptions.clients} />
          <FilterSelect label="All campaigns" value={filters.campaignId} onChange={(value) => setFilters((current) => ({ ...current, campaignId: value }))} options={filterOptions.campaigns} />
          <FilterSelect label="All owners" value={filters.ownerId} onChange={(value) => setFilters((current) => ({ ...current, ownerId: value }))} options={filterOptions.owners} />
          <select
            value={filters.risk}
            onChange={(event) => setFilters((current) => ({ ...current, risk: event.target.value }))}
            className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-start-5"
          >
            <option value="">All risk</option>
            {riskOptions.map((risk) => (
              <option key={risk} value={risk}>{formatLabel(risk)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/10 lg:rounded-3xl lg:p-4 lg:shadow-2xl">
        {isLoading ? (
          <div className="p-4 text-sm text-zinc-500">Loading workflow board...</div>
        ) : firstLoadError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{firstLoadError}</div>
        ) : actionError || error ? (
          <WorkflowActionErrorBanner error={actionError || error} />
        ) : !hasItems ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-zinc-400">No items</div>
            <h3 className="mt-4 text-lg font-semibold text-white">No workflow items match this view</h3>
            <p className="mt-2 text-sm text-zinc-400">Create content assets or clear filters to see production movement.</p>
          </div>
        ) : (
          <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
            {board?.columns.map((column) => (
              <section key={column.stage} className="min-w-72 flex-1 rounded-2xl border border-zinc-800 bg-[#0b0b11]">
                <div className="flex items-center justify-between border-b border-zinc-800/70 px-4 py-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{column.label}</h2>
                    <p className="mt-1 text-xs text-zinc-600">{column.count} items</p>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  {column.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-600">Nothing here</div>
                  ) : (
                    column.items.map((item) => (
                      <button
                        key={item.contentAssetId}
                        type="button"
                        onClick={() => selectItem(item)}
                        className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:bg-zinc-900/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-indigo-300">{item.displayCode}</div>
                            <div className="mt-1 truncate text-sm font-semibold text-white">{item.title}</div>
                          </div>
                          <RiskBadge risk={item.riskStatus} />
                        </div>
                        <div className="mt-3 space-y-1.5 text-xs text-zinc-500">
                          <div className="truncate">{item.clientName} · {item.campaignName}</div>
                          <div>Owner: <span className="text-zinc-300">{item.owner?.name || "Unassigned"}</span></div>
                          <div>Due: <span className="text-zinc-300">{formatDateTime(item.deadlineAt)}</span></div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.taskStatus ? <MiniPill>{formatLabel(item.taskStatus)}</MiniPill> : null}
                            {item.submissionStatus ? <MiniPill>{formatLabel(item.submissionStatus)}</MiniPill> : null}
                            {item.hasActiveBlocker ? <MiniPill tone="danger">Blocked</MiniPill> : null}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isLoading && !error && !actionError && hasItems && mobileColumn ? (
          <div className="lg:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              {board?.columns.map((column) => (
                <button
                  key={column.stage}
                  type="button"
                  onClick={() => setMobileStage(column.stage)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    effectiveMobileStage === column.stage
                      ? "bg-indigo-500 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  {column.label} ({column.count})
                </button>
              ))}
            </div>

            <section className="mt-3 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-3">
              <div className="space-y-3">
                {mobileColumn.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-600">
                    Nothing in {mobileColumn.label}
                  </div>
                ) : (
                  mobileColumn.items.map((item) => (
                    <button
                      key={item.contentAssetId}
                      type="button"
                      onClick={() => selectItem(item)}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:bg-zinc-900/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-indigo-300">{item.displayCode}</div>
                          <div className="mt-1 truncate text-sm font-semibold text-white">{item.title}</div>
                        </div>
                        <RiskBadge risk={item.riskStatus} />
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-zinc-500">
                        <div className="truncate">{item.clientName} · {item.campaignName}</div>
                        <div>Owner: <span className="text-zinc-300">{item.owner?.name || "Unassigned"}</span></div>
                        <div>Due: <span className="text-zinc-300">{formatDateTime(item.deadlineAt)}</span></div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-[#09090d] p-4 lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">{selectedItem.displayCode}</div>
                <h2 className="mt-1 text-lg font-semibold text-white">{selectedItem.title}</h2>
                <p className="mt-1 text-xs text-zinc-500">{selectedItem.clientName} · {selectedItem.campaignName}</p>
              </div>
              <button
                type="button"
                onClick={() => selectItem(null)}
                className="rounded-full border border-zinc-800 p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Detail label="Stage" value={formatLabel(selectedItem.stage)} />
              <Detail label="Task status" value={selectedItem.taskStatus ? formatLabel(selectedItem.taskStatus) : "None"} />
              <Detail label="Owner" value={selectedItem.owner?.name || "Unassigned"} />
              <Detail label="Manager" value={selectedItem.manager?.name || "Unassigned"} />
              <Detail label="Deadline" value={formatDateTime(selectedItem.deadlineAt)} />
              <Detail label="Submission" value={selectedItem.submissionStatus ? formatLabel(selectedItem.submissionStatus) : "No submission"} />
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">What happens next</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{nextActionText(selectedItem)}</p>
            </div>

            <ClientContextCard
              client={selectedItem.clientSummary}
              fallbackName={selectedItem.clientName}
              onView={() => router.push(getWorkspaceHref(safeAgencySlug, `/clients/${selectedItem.clientId}`))}
            />

            <WorkflowActionPanel
              item={selectedItem}
              roleKeys={roleKeys}
              draft={actionDraft}
              actionError={actionError}
              currentMembershipId={currentMembershipId}
              isRunning={isActionRunning}
              onDraftChange={setActionDraft}
              onAction={runWorkflowAction}
            />

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => router.push(getWorkspaceHref(safeAgencySlug, `/workflow/${selectedItem.contentAssetId}`))}
                className="min-h-11 rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 lg:rounded-full"
              >
                Open full details
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowActionErrorBanner({ error }: { error: ParsedApiError | string | null }) {
  if (!error) return null;
  const parsed = typeof error === "string" ? parseApiError(error) : error;

  if (parsed.isCampaignReviewAccessRequired) {
    const managerName = parsed.currentCampaignManager?.name;
    const suggestion =
      parsed.suggestion ||
      (managerName
        ? `Ask to be added as a campaign manager or reviewer, or contact ${managerName}.`
        : "Ask to be added as a campaign manager or reviewer, or contact the current campaign manager.");

    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="space-y-1.5">
            <h4 className="font-semibold text-red-300">Approval access required</h4>
            <p className="text-zinc-300">You don&apos;t have approval access for this campaign.</p>
            {managerName ? (
              <p className="text-xs font-medium text-white">
                Current campaign manager: <span className="text-indigo-300">{managerName}</span>
              </p>
            ) : null}
            <p className="text-xs text-zinc-400">{suggestion}</p>
          </div>
        </div>
      </div>
    );
  }

  if (parsed.isForbidden) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="space-y-1">
            <h4 className="font-semibold text-red-300">Permission denied</h4>
            <p className="text-zinc-300">{parsed.message || "You don't have permission to perform this action."}</p>
            {parsed.suggestion ? <p className="text-xs text-zinc-400">{parsed.suggestion}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {parsed.message}
    </div>
  );
}

function WorkflowActionPanel({
  item,
  roleKeys,
  currentMembershipId,
  draft,
  actionError,
  isRunning,
  onDraftChange,
  onAction,
}: {
  item: WorkflowBoardItem;
  roleKeys: string[];
  currentMembershipId: string | null;
  draft: { externalLink: string; comment: string; reason: string };
  actionError?: ParsedApiError | null;
  isRunning: boolean;
  onDraftChange: (value: { externalLink: string; comment: string; reason: string }) => void;
  onAction: (action: WorkflowActionType) => void;
}) {
  const isTaskOwner =
    Boolean(currentMembershipId) &&
    item.owner?.membershipId === currentMembershipId;
  const submitAction = submitActionFor(item.stage, isTaskOwner);
  const reviewActions = reviewActionsFor(
    item.stage,
    roleKeys,
    isTaskOwner,
  );
  const hasValidUrl = isValidSubmissionUrl(draft.externalLink);
  const canSubmit = Boolean(submitAction) && hasValidUrl && !item.hasActiveBlocker && item.taskStatus !== "COMPLETED";
  const canShowSubmit = Boolean(submitAction) && !item.hasActiveBlocker && item.taskStatus !== "COMPLETED";
  const canReview = reviewActions.length > 0 && !item.hasActiveBlocker;
  const canActOnStage = canShowSubmit || canReview;
  const showBlock = canActOnStage && !item.hasActiveBlocker && item.stage !== "PUBLISHED";
  const showUnblock = canActOnStage && item.hasActiveBlocker;

  if (!canShowSubmit && !canReview && !showBlock && !showUnblock) return null;

  return (
    <section className="mt-4 rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:mt-6 lg:rounded-2xl lg:p-4">
      {actionError ? (
        <div className="mb-4">
          <WorkflowActionErrorBanner error={actionError} />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Move this work</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Submissions, approvals, handovers, rejections, and blockers are recorded as workflow events.</p>
        </div>
        <MiniPill>{formatLabel(item.stage)}</MiniPill>
      </div>

      {canShowSubmit ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Link or note

            <input
              type="url"
              value={draft.externalLink}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  externalLink: event.target.value,
                })
              }
              placeholder={submitPlaceholder(item.stage)}
              className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />

            {draft.externalLink.trim() && !hasValidUrl ? (
              <p className="mt-1 text-xs font-normal normal-case tracking-normal text-red-500">
                Enter a valid URL starting with https:// or http://
              </p>
            ) : null}
          </label>
          <button
            type="button"
            disabled={isRunning || !canSubmit}
            onClick={() => submitAction && onAction(submitAction.action)}
            className="min-h-11 w-full rounded-md bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full"
          >
            {isRunning ? "Moving..." : submitAction?.label}
          </button>
        </div>
      ) : null}

      {canReview ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Review comment
            <textarea
              value={draft.comment}
              onChange={(event) => onDraftChange({ ...draft, comment: event.target.value })}
              rows={3}
              placeholder="Add a clear note for the next person."
              className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition focus:border-indigo-500 lg:rounded-2xl lg:text-sm"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {reviewActions.map((action) => (
              <button
                key={action.action}
                type="button"
                disabled={isRunning}
                onClick={() => onAction(action.action)}
                className={`min-h-11 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full ${action.tone === "danger" ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15" : "bg-emerald-500 px-4 text-white hover:bg-emerald-400"}`}
              >
                {isRunning ? "Moving..." : action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showBlock || showUnblock ? (
        <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
          {showBlock ? (
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Blocker reason
              <input
                value={draft.reason}
                onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
                placeholder="Waiting for assets, unclear brief, missing footage..."
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-base text-white outline-none transition focus:border-indigo-500 lg:rounded-2xl lg:text-sm"
              />
            </label>
          ) : null}
          <button
            type="button"
            disabled={isRunning || (showBlock && !draft.reason.trim())}
            onClick={() => onAction(showUnblock ? "UNBLOCK" : "BLOCK")}
            className={`min-h-11 w-full rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full ${showUnblock ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15" : "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"}`}
          >
            {isRunning ? "Saving..." : showUnblock ? "Resolve blocker" : "Raise blocker"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "attention" | "danger" }) {
  const valueClass = tone === "danger" ? "text-red-300" : tone === "attention" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-1 lg:p-2 shadow-lg shadow-black/10 lg:rounded-xl lg:p-1 lg:shadow-xl">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold lg:mt-2 lg:text-xl ${valueClass}`}>{value}</div>
    </div>
  );
}

function isValidSubmissionUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function WorkflowFilters({
  filters,
  setFilters,
  options,
}: {
  filters: { clientId: string; campaignId: string; ownerId: string; risk: string; search: string };
  setFilters: Dispatch<SetStateAction<{ clientId: string; campaignId: string; ownerId: string; risk: string; search: string }>>;
  options: {
    clients: Array<{ id: string; label: string }>;
    campaigns: Array<{ id: string; label: string }>;
    owners: Array<{ id: string; label: string }>;
  };
}) {
  return (
    <>
      <input
        value={filters.search}
        onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        placeholder="Search code, client, campaign"
        className="min-h-11 rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none transition focus:border-indigo-500"
      />
      <FilterSelect label="All clients" value={filters.clientId} onChange={(value) => setFilters((current) => ({ ...current, clientId: value }))} options={options.clients} compact />
      <FilterSelect label="All campaigns" value={filters.campaignId} onChange={(value) => setFilters((current) => ({ ...current, campaignId: value }))} options={options.campaigns} compact />
      <FilterSelect label="All owners" value={filters.ownerId} onChange={(value) => setFilters((current) => ({ ...current, ownerId: value }))} options={options.owners} compact />
      <select
        value={filters.risk}
        onChange={(event) => setFilters((current) => ({ ...current, risk: event.target.value }))}
        className="min-h-11 rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none transition focus:border-indigo-500"
      >
        <option value="">All risk</option>
        {riskOptions.map((risk) => (
          <option key={risk} value={risk}>{formatLabel(risk)}</option>
        ))}
      </select>
    </>
  );
}

function FilterSelect({ label, value, onChange, options, compact = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; compact?: boolean }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={compact ? "min-h-11 rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none transition focus:border-indigo-500" : "rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500"}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-2xl lg:p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-2 truncate text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function ClientContextCard({
  client,
  fallbackName,
  onView,
}: {
  client?: WorkflowBoardItem["clientSummary"];
  fallbackName: string;
  onView: () => void;
}) {
  const socialLinks = client?.socialLinks
    ? Object.entries(client.socialLinks).filter(([, value]) => Boolean(value))
    : [];

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Client vibe</h3>
          <div className="mt-2 text-lg font-semibold text-white">{client?.name || fallbackName}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
            {client?.industry ? <span>{client.industry}</span> : null}
            {client?.brandVoice ? <span>{formatLabel(client.brandVoice)}</span> : null}
            {client?.brandPersonality ? <span>{formatLabel(client.brandPersonality)}</span> : null}
          </div>
        </div>
        <button type="button" onClick={onView} className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white">
          View client
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-zinc-400">
        {client?.tagline ? <ContextLine label="Tagline" value={client.tagline} /> : null}
        {client?.description ? <ContextLine label="Business" value={client.description} /> : null}
        {client?.audience ? <ContextLine label="Audience" value={client.audience} /> : null}
        {client?.audiencePainPoints ? <ContextLine label="Pain points" value={client.audiencePainPoints} /> : null}
        {client?.contentGoals ? <ContextLine label="Goals" value={client.contentGoals} /> : null}
        {socialLinks.length ? (
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Social</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {socialLinks.map(([key, value]) => (
                <a key={key} href={String(value)} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-indigo-500 hover:text-white">
                  {formatLabel(key)}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-1 leading-6 text-zinc-300">{value}</div>
    </div>
  );
}

function MiniPill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "danger" }) {
  return <span className={statusPillClasses(tone === "danger" ? "BLOCKED" : String(children))}>{children}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-tight ${riskBadgeWidth(risk)} ${statusPillClass(risk)}`}>
      {formatLabel(risk)}
    </span>
  );
}

function uniqueBy(options: Array<{ id: string; label: string }>) {
  const seen = new Map<string, { id: string; label: string }>();
  options.forEach((option) => {
    if (!seen.has(option.id)) seen.set(option.id, option);
  });
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function formatDateTime(value?: string | null) {
  if (!value) return "No deadline";
  return new Date(value).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function riskBadgeWidth(risk: string) {
  if (risk === "NEEDS_ATTENTION") return "w-[5.75rem]";
  if (risk === "ON_TRACK" || risk === "AT_RISK") return "w-[4.25rem]";
  return "w-auto min-w-[4.25rem]";
}

function nextActionText(item: WorkflowBoardItem) {
  if (item.hasActiveBlocker) return "Resolve the blocker before this item can move cleanly.";
  if (!item.owner) return "Assign an owner so the next person knows this belongs to them.";
  if (item.taskStatus === "WAITING_REVIEW") return "Manager review is needed. Approve, request changes, or assign the next stage.";
  if (item.submissionStatus === "SUBMITTED") return "A submission is waiting to be seen or reviewed.";
  if (item.stage === "IDEA") return "Move this into writing once the brief is ready.";
  if (item.stage === "PUBLISHED") return "This item is published. Use history and performance views next.";
  return "The current owner should complete their work or raise a blocker if they need help.";
}

function submitActionFor(
  stage: string,
  isTaskOwner: boolean,
): { action: WorkflowActionType; label: string } | null {
  if (!isTaskOwner) return null;

  if (stage === "WRITING") {
    return {
      action: "SUBMIT_FOR_REVIEW",
      label: "Submit script for review",
    };
  }

  if (stage === "SHOOT") {
    return {
      action: "SUBMIT_FOR_REVIEW",
      label: "Submit footage handover",
    };
  }

  if (stage === "EDITING") {
    return {
      action: "SUBMIT_FOR_REVIEW",
      label: "Submit edit for review",
    };
  }

  return null;
}

function submitPlaceholder(stage: string) {
  if (stage === "WRITING") return "Script link, notes, or Google Doc";
  if (stage === "SHOOT") return "Google Drive folder with raw footage";
  if (stage === "EDITING") return "Draft edit, Frame.io, or Drive link";
  return "Add a link or note";
}

function reviewActionsFor(
  stage: string,
  roleKeys: string[],
  isTaskOwnerOrResponsible: boolean = false,
): Array<{ action: WorkflowActionType; label: string; tone?: "success" | "danger" }> {
  const isEditor = hasRole(roleKeys, "EDITOR") || isTaskOwnerOrResponsible;
  const isManager = hasAnyWorkflowRole(roleKeys, ["OWNER", "ADMIN", "MANAGER"]);

  if (stage === "EDITOR_INTAKE" && (isEditor || isManager)) {
    return [
      { action: "ACCEPT_HANDOVER", label: "Accept handover" },
      { action: "REJECT", label: "Reject handover", tone: "danger" },
    ];
  }

  if (
    ["MANAGER_SCRIPT_REVIEW", "MANAGER_EDIT_REVIEW", "CLIENT_APPROVAL"].includes(
      stage,
    ) &&
    (isManager || isTaskOwnerOrResponsible)
  ) {
    return [
      { action: "APPROVE", label: "Approve" },
      { action: "REQUEST_CHANGES", label: "Request changes", tone: "danger" },
    ];
  }

  return [];
}

function hasRole(roleKeys: string[], roleKey: string) {
  return roleKeys.includes(roleKey);
}

function hasAnyWorkflowRole(roleKeys: string[], allowed: string[]) {
  return roleKeys.some((roleKey) => allowed.includes(roleKey));
}
