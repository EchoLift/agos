"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { ContentAsset, getContentAsset, updateContentAsset } from "@/lib/api/content";
import { performWorkflowAction, WorkflowActionType } from "@/lib/api/workflow";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { getAgencyRoleKeys } from "@/lib/workspace-access";

const contentTypes = ["REEL", "CAROUSEL", "STATIC", "STORY", "BLOG", "YOUTUBE", "AD", "OTHER"];

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams<{ contentId: string }>();
  const { agencyId, agencySlug, agency } = useAgency();
  const roleKeys = useMemo(() => getAgencyRoleKeys(agency), [agency]);
  const canEditAsset = roleKeys.some((roleKey) => ["OWNER", "ADMIN", "MANAGER"].includes(roleKey));
  const [asset, setAsset] = useState<ContentAsset | null>(null);
  const [draft, setDraft] = useState({ title: "", type: "REEL", brief: "" });
  const [actionDraft, setActionDraft] = useState({ externalLink: "", comment: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId || !params.contentId) return;
    let isMounted = true;

    getContentAsset(agencyId, params.contentId)
      .then((data) => {
        if (!isMounted) return;
        setAsset(data);
        setDraft({ title: data.title || "", type: data.type || "REEL", brief: data.brief || "" });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load workflow.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId, params.contentId]);

  const save = async () => {
    if (!agencyId || !asset) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateContentAsset(agencyId, asset.id, draft);
      setAsset(updated);
      setDraft({ title: updated.title || "", type: updated.type || "REEL", brief: updated.brief || "" });
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save workflow item.");
    } finally {
      setIsSaving(false);
    }
  };

  const runWorkflowAction = async (action: WorkflowActionType) => {
    if (!agencyId || !asset) return;
    setIsActionRunning(true);
    setError(null);

    const trimmedLink = actionDraft.externalLink.trim();
    const trimmedComment = actionDraft.comment.trim();

    try {
      await performWorkflowAction(agencyId, asset.id, {
        action,
        idempotencyKey: `${action}:${asset.id}:${Date.now()}`,
        ...(trimmedLink
          ? trimmedLink.startsWith("http")
            ? { externalLink: trimmedLink }
            : { body: trimmedLink }
          : {}),
        ...(trimmedComment ? { comment: trimmedComment } : {}),
      });
      const updated = await getContentAsset(agencyId, asset.id);
      setAsset(updated);
      setActionDraft({ externalLink: "", comment: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Workflow action failed.");
    } finally {
      setIsActionRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3 lg:space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 lg:gap-4">
          <button
            type="button"
            onClick={() => router.push(`/workflow`)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white lg:rounded-full"
          >
            ←
          </button>
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Workflow</p>
            <h1 className="mt-1 truncate text-2xl font-semibold leading-tight text-white lg:text-3xl">{asset?.title || (isLoading ? "Loading..." : "Workflow Item")}</h1>
          </div>
        </div>
        {asset && canEditAsset ? (
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            className="min-h-11 shrink-0 rounded-md border border-zinc-800 px-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 lg:rounded-full lg:px-4"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/20 sm:p-4 lg:rounded-xl lg:p-6">
        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading workflow...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : asset ? (
          <div className="space-y-3 lg:space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={statusPillClasses(asset.stage || "DRAFT", "sm")}>
                {formatLabel(asset.stage || "DRAFT")}
              </span>
              <span className={statusPillClasses(asset.status, "sm")}>{asset.status}</span>
              <span className="text-xs text-zinc-600">{asset.displayCode || asset.id.slice(0, 8)}</span>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-zinc-300">
                  Task Title
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none transition focus:border-indigo-500"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Type
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none transition focus:border-indigo-500"
                  >
                    {contentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Brief
                  <textarea
                    value={draft.brief}
                    onChange={(event) => setDraft((current) => ({ ...current, brief: event.target.value }))}
                    rows={5}
                    className="mt-2 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 py-3 text-base text-white outline-none transition focus:border-indigo-500"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSaving || !draft.title.trim()}
                    onClick={save}
                    className="min-h-11 rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full"
                  >
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-5">
                <div className="grid gap-2 sm:grid-cols-2 lg:gap-4">
                  <Detail label="Type" value={asset.type} />
                  <Detail label="Stage" value={asset.stage || "Draft"} />
                  <Detail label="Campaign" value={asset.campaignSummary?.name || asset.campaignId} />
                  <Detail label="Client" value={asset.clientSummary?.name || asset.clientId} />
                </div>
                <section className="grid gap-2 lg:grid-cols-[0.8fr_1.2fr] lg:gap-4">
                  <CampaignContext campaign={asset.campaignSummary} />
                  <ClientContext
                    client={asset.clientSummary}
                    fallbackName={asset.clientSummary?.name || asset.clientId}
                    onView={() => router.push(`/clients/${asset.clientId}`)}
                  />
                </section>
                <LatestSubmissionCard submission={asset.latestSubmission} />
                <WorkflowDetailActions
                  stage={asset.stage || "DRAFT"}
                  roleKeys={roleKeys}
                  draft={actionDraft}
                  isRunning={isActionRunning}
                  onDraftChange={setActionDraft}
                  onAction={runWorkflowAction}
                />
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Brief</h2>
                  <p className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 text-sm leading-6 text-zinc-300">
                    {asset.brief || "No brief added yet."}
                  </p>
                </section>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LatestSubmissionCard({ submission }: { submission: ContentAsset["latestSubmission"] }) {
  if (!submission) return null;

  const submittedValue = submission.externalLink || submission.body || "";
  const isLink = submittedValue.startsWith("http");

  return (
    <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-lg lg:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Latest submission</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={statusPillClasses(submission.submissionType)}>{formatLabel(submission.submissionType)}</span>
            <span className={statusPillClasses(submission.status)}>{formatLabel(submission.status)}</span>
            <span className="text-xs text-zinc-600">v{submission.version}</span>
          </div>
        </div>
        <div className="text-xs text-zinc-600">{formatSubmittedAt(submission.createdAt)}</div>
      </div>

      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3">
        <div className="text-xs uppercase tracking-wider text-zinc-600">Handoff URL / note</div>
        {submittedValue ? (
          isLink ? (
            <a
              href={submittedValue}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-sm font-semibold text-indigo-300 transition hover:text-indigo-200"
            >
              {submittedValue}
            </a>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{submittedValue}</p>
          )
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No handoff link or note was attached.</p>
        )}
      </div>
    </section>
  );
}

function CampaignContext({ campaign }: { campaign: ContentAsset["campaignSummary"] }) {
  return (
    <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-lg lg:p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Campaign context</h2>
      <div className="mt-3 space-y-2">
        <ContextLine label="Name" value={campaign?.name} />
        <ContextLine label="Type" value={campaign?.campaignType ? formatLabel(campaign.campaignType) : null} />
        <ContextLine label="Goal" value={campaign?.goal ? formatLabel(campaign.goal) : null} />
        <ContextLine label="CTA" value={campaign?.cta ? formatLabel(campaign.cta) : null} />
        <ContextLine label="Key message" value={campaign?.keyMessage} />
      </div>
    </section>
  );
}

function WorkflowDetailActions({
  stage,
  roleKeys,
  draft,
  isRunning,
  onDraftChange,
  onAction,
}: {
  stage: string;
  roleKeys: string[];
  draft: { externalLink: string; comment: string };
  isRunning: boolean;
  onDraftChange: (value: { externalLink: string; comment: string }) => void;
  onAction: (action: WorkflowActionType) => void;
}) {
  const submitAction = submitActionFor(stage, roleKeys);
  const reviewActions = reviewActionsFor(stage, roleKeys);
  const canSubmit = Boolean(submitAction) && Boolean(draft.externalLink.trim());

  if (!submitAction && reviewActions.length === 0) return null;

  return (
    <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-lg lg:p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Task flow</h2>
      <p className="mt-1 text-xs leading-5 text-zinc-500">Move the current stage forward with a recorded submission, handover, approval, or change request.</p>

      {submitAction ? (
        <div className="mt-3 space-y-3">
          <input
            value={draft.externalLink}
            onChange={(event) => onDraftChange({ ...draft, externalLink: event.target.value })}
            placeholder={submitPlaceholder(stage)}
            className="min-h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-base text-white outline-none transition focus:border-indigo-500 sm:text-sm"
          />
          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-3 border-t border-zinc-800 bg-[#0b0b11]/95 p-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <button
              type="button"
              disabled={isRunning || !canSubmit}
              onClick={() => onAction(submitAction.action)}
              className="min-h-11 w-full rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:rounded-full"
            >
              {isRunning ? "Moving..." : submitAction.label}
            </button>
          </div>
        </div>
      ) : null}

      {reviewActions.length ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={draft.comment}
            onChange={(event) => onDraftChange({ ...draft, comment: event.target.value })}
            rows={3}
            placeholder="Review comment or reason"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition focus:border-indigo-500 sm:text-sm"
          />
          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-3 flex gap-2 border-t border-zinc-800 bg-[#0b0b11]/95 p-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            {reviewActions.map((action) => (
              <button
                key={action.action}
                type="button"
                disabled={isRunning}
                onClick={() => onAction(action.action)}
                className={`min-h-11 flex-1 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none lg:rounded-full ${action.tone === "danger" ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}
              >
                {isRunning ? "Moving..." : action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClientContext({
  client,
  fallbackName,
  onView,
}: {
  client: ContentAsset["clientSummary"];
  fallbackName: string;
  onView: () => void;
}) {
  const socialLinks = client?.socialLinks
    ? Object.entries(client.socialLinks).filter(([, value]) => Boolean(value))
    : [];

  return (
    <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-lg lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Client vibe</h2>
          <div className="mt-2 text-lg font-semibold text-white">{client?.name || fallbackName}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {client?.industry ? <span className={statusPillClasses(client.industry)}>{client.industry}</span> : null}
            {client?.brandVoice ? <span className={statusPillClasses(client.brandVoice)}>{formatLabel(client.brandVoice)}</span> : null}
            {client?.brandPersonality ? <span className={statusPillClasses(client.brandPersonality)}>{formatLabel(client.brandPersonality)}</span> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onView}
          className="min-h-11 shrink-0 rounded-md border border-zinc-800 px-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white lg:rounded-full"
        >
          View client
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <ContextLine label="Tagline" value={client?.tagline} />
        <ContextLine label="Business" value={client?.description} />
        <ContextLine label="Audience" value={client?.audience} />
        <ContextLine label="Locations" value={client?.audienceLocations} />
        <ContextLine label="Pain points" value={client?.audiencePainPoints} />
        <ContextLine label="Goals" value={client?.contentGoals} />
        {socialLinks.length ? (
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Social</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {socialLinks.map(([key, value]) => (
                <a
                  key={key}
                  href={String(value)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-indigo-500 hover:text-white"
                >
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

function ContextLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-1 text-sm leading-6 text-zinc-300">{value || "—"}</div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-lg lg:p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className={`mt-2 truncate text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}

function formatSubmittedAt(value: string) {
  return new Date(value).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function submitActionFor(stage: string, roleKeys: string[]): { action: WorkflowActionType; label: string } | null {
  if (stage === "WRITING" && hasRole(roleKeys, "WRITER")) return { action: "SUBMIT_FOR_REVIEW", label: "Submit script" };
  if (stage === "SHOOT" && hasRole(roleKeys, "DOP")) return { action: "SUBMIT_FOR_REVIEW", label: "Submit footage" };
  if (stage === "EDITING" && hasRole(roleKeys, "EDITOR")) return { action: "SUBMIT_FOR_REVIEW", label: "Submit edit" };
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
