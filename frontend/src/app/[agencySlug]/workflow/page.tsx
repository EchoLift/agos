"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { getWorkflowBoard, performWorkflowAction, WorkflowActionType, WorkflowBoard, WorkflowBoardItem } from "@/lib/api/workflow";
import { formatLabel, statusPillClass, statusPillClasses } from "@/lib/status-style";
import { getAgencyRoleKeys } from "@/lib/workspace-access";

const riskOptions = ["ON_TRACK", "NEEDS_ATTENTION", "AT_RISK", "BLOCKED", "OVERDUE"];

export default function WorkflowPage() {
  const { agencyId, agencySlug, agency } = useAgency();
  const router = useRouter();
  const roleKeys = useMemo(() => getAgencyRoleKeys(agency), [agency]);
  const [board, setBoard] = useState<WorkflowBoard | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkflowBoardItem | null>(null);
  const [filters, setFilters] = useState({ clientId: "", campaignId: "", ownerId: "", risk: "", search: "" });
  const [actionDraft, setActionDraft] = useState({ externalLink: "", comment: "", reason: "" });
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    const data = await getWorkflowBoard(agencyId, filters);
    setBoard(data);
    setError(null);
    setIsLoading(false);
    return data;
  }, [agencyId, filters]);

  useEffect(() => {
    let isMounted = true;

    loadBoard()
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load workflow board.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadBoard]);

  useEffect(() => {
    setActionDraft({ externalLink: "", comment: "", reason: "" });
  }, [selectedItem?.contentAssetId, selectedItem?.stage]);

  const runWorkflowAction = async (action: WorkflowActionType) => {
    if (!agencyId || !selectedItem) return;
    setIsActionRunning(true);
    setError(null);

    const trimmedLink = actionDraft.externalLink.trim();
    const trimmedComment = actionDraft.comment.trim();
    const trimmedReason = actionDraft.reason.trim();

    try {
      const refreshed = await performWorkflowAction(agencyId, selectedItem.contentAssetId, {
        action,
        idempotencyKey: `${action}:${selectedItem.workflowTaskId ?? selectedItem.contentAssetId}:${Date.now()}`,
        ...(trimmedLink
          ? trimmedLink.startsWith("http")
            ? { externalLink: trimmedLink }
            : { body: trimmedLink }
          : {}),
        ...(trimmedComment ? { comment: trimmedComment } : {}),
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      }).then(() => loadBoard());

      const nextSelected = refreshed?.columns.flatMap((column) => column.items).find((item) => item.contentAssetId === selectedItem.contentAssetId) ?? null;
      setSelectedItem(nextSelected);
      setActionDraft({ externalLink: "", comment: "", reason: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Workflow action failed.");
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Operations</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Workflow</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            What is moving, what is stuck, who owns it, and what should happen next.
          </p>
        </div>
        <div className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-400">Board view</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <SummaryCard label="Active" value={board?.summary.active ?? 0} />
        <SummaryCard label="Waiting Review" value={board?.summary.waitingReview ?? 0} />
        <SummaryCard label="Blocked" value={board?.summary.blocked ?? 0} tone="danger" />
        <SummaryCard label="Overdue" value={board?.summary.overdue ?? 0} tone="danger" />
        <SummaryCard label="Due Today" value={board?.summary.dueToday ?? 0} tone="attention" />
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
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

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
        {isLoading ? (
          <div className="p-4 text-sm text-zinc-500">Loading workflow board...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : !hasItems ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-zinc-400">No items</div>
            <h3 className="mt-4 text-lg font-semibold text-white">No workflow items match this view</h3>
            <p className="mt-2 text-sm text-zinc-400">Create content assets or clear filters to see production movement.</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
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
                        onClick={() => setSelectedItem(item)}
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
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button type="button" className="flex-1 cursor-default" aria-label="Close workflow detail" onClick={() => setSelectedItem(null)} />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-indigo-300">{selectedItem.displayCode}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedItem.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">{selectedItem.clientName} · {selectedItem.campaignName}</p>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)} className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white">Close</button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Detail label="Current Stage" value={formatLabel(selectedItem.stage)} />
              <Detail label="Risk" value={formatLabel(selectedItem.riskStatus)} />
              <Detail label="Owner" value={selectedItem.owner?.name || "Unassigned"} />
              <Detail label="Manager" value={selectedItem.manager?.name || "Unassigned"} />
              <Detail label="Deadline" value={formatDateTime(selectedItem.deadlineAt)} />
              <Detail label="Last Activity" value={formatDateTime(selectedItem.lastActivityAt)} />
              <Detail label="Task Status" value={selectedItem.taskStatus ? formatLabel(selectedItem.taskStatus) : "Not started"} />
              <Detail label="Submission" value={selectedItem.submissionStatus ? formatLabel(selectedItem.submissionStatus) : "No submission"} />
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">What happens next</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{nextActionText(selectedItem)}</p>
            </div>

            <ClientContextCard
              client={selectedItem.clientSummary}
              fallbackName={selectedItem.clientName}
              onView={() => router.push(`/${agencySlug}/clients/${selectedItem.clientId}`)}
            />

            <WorkflowActionPanel
              item={selectedItem}
              roleKeys={roleKeys}
              draft={actionDraft}
              isRunning={isActionRunning}
              onDraftChange={setActionDraft}
              onAction={runWorkflowAction}
            />

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => router.push(`/${agencySlug}/workflow/${selectedItem.contentAssetId}`)}
                className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
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

function WorkflowActionPanel({
  item,
  roleKeys,
  draft,
  isRunning,
  onDraftChange,
  onAction,
}: {
  item: WorkflowBoardItem;
  roleKeys: string[];
  draft: { externalLink: string; comment: string; reason: string };
  isRunning: boolean;
  onDraftChange: (value: { externalLink: string; comment: string; reason: string }) => void;
  onAction: (action: WorkflowActionType) => void;
}) {
  const submitAction = submitActionFor(item.stage, roleKeys);
  const reviewActions = reviewActionsFor(item.stage, roleKeys);
  const hasSubmissionContent = Boolean(draft.externalLink.trim());
  const canSubmit = Boolean(submitAction) && hasSubmissionContent && !item.hasActiveBlocker && item.taskStatus !== "COMPLETED";
  const canShowSubmit = Boolean(submitAction) && !item.hasActiveBlocker && item.taskStatus !== "COMPLETED";
  const canReview = reviewActions.length > 0 && !item.hasActiveBlocker;
  const canActOnStage = canShowSubmit || canReview;
  const showBlock = canActOnStage && !item.hasActiveBlocker && item.stage !== "PUBLISHED";
  const showUnblock = canActOnStage && item.hasActiveBlocker;

  if (!canShowSubmit && !canReview && !showBlock && !showUnblock) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
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
              value={draft.externalLink}
              onChange={(event) => onDraftChange({ ...draft, externalLink: event.target.value })}
              placeholder={submitPlaceholder(item.stage)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
            />
          </label>
          <button
            type="button"
            disabled={isRunning || !canSubmit}
            onClick={() => submitAction && onAction(submitAction.action)}
            className="w-full rounded-full bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {reviewActions.map((action) => (
              <button
                key={action.action}
                type="button"
                disabled={isRunning}
                onClick={() => onAction(action.action)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${action.tone === "danger" ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15" : "bg-emerald-500 px-4 text-white hover:bg-emerald-400"}`}
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
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
              />
            </label>
          ) : null}
          <button
            type="button"
            disabled={isRunning || (showBlock && !draft.reason.trim())}
            onClick={() => onAction(showUnblock ? "UNBLOCK" : "BLOCK")}
            className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${showUnblock ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15" : "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"}`}
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
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className={`mt-4 text-3xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
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

function submitActionFor(stage: string, roleKeys: string[]): { action: WorkflowActionType; label: string } | null {
  if (stage === "WRITING" && hasRole(roleKeys, "WRITER")) return { action: "SUBMIT_FOR_REVIEW", label: "Submit script for review" };
  if (stage === "SHOOT" && hasRole(roleKeys, "DOP")) return { action: "SUBMIT_FOR_REVIEW", label: "Submit footage handover" };
  if (stage === "EDITING" && hasRole(roleKeys, "EDITOR")) return { action: "SUBMIT_FOR_REVIEW", label: "Submit edit for review" };
  return null;
}

function submitPlaceholder(stage: string) {
  if (stage === "WRITING") return "Script link, notes, or Google Doc";
  if (stage === "SHOOT") return "Google Drive folder with raw footage";
  if (stage === "EDITING") return "Draft edit, Frame.io, or Drive link";
  return "Add a link or note";
}

function reviewActionsFor(stage: string, roleKeys: string[]): Array<{ action: WorkflowActionType; label: string; tone?: "success" | "danger" }> {
  if (stage === "EDITOR_INTAKE" && hasRole(roleKeys, "EDITOR")) {
    return [
      { action: "ACCEPT_HANDOVER", label: "Accept handover" },
      { action: "REJECT", label: "Reject handover", tone: "danger" },
    ];
  }

  if (["MANAGER_SCRIPT_REVIEW", "MANAGER_EDIT_REVIEW", "CLIENT_APPROVAL"].includes(stage) && hasAnyWorkflowRole(roleKeys, ["OWNER", "ADMIN", "MANAGER"])) {
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
