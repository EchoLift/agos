"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import {
  approveWorkOrder,
  getWorkOrder,
  requestWorkOrderChanges,
  submitWorkOrder,
  WorkOrder,
} from "@/lib/api/work-orders";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { getAgencyRoleKeys } from "@/lib/workspace-access";

export default function GigDetailPage() {
  const router = useRouter();
  const params = useParams<{ workOrderId: string }>();
  const { agencyId, agencySlug, agency } = useAgency();
  const roleKeys = useMemo(() => getAgencyRoleKeys(agency), [agency]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [submissionDraft, setSubmissionDraft] = useState({ body: "", externalLink: "" });
  const [reviewComment, setReviewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId || !params.workOrderId) return;
    let isMounted = true;

    getWorkOrder(agencyId, params.workOrderId)
      .then((data) => {
        if (!isMounted) return;
        setWorkOrder(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load gig.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId, params.workOrderId]);

  const canSubmit = Boolean(
    workOrder &&
    workOrder.assignee?.id === agency?.membershipId &&
    ["ASSIGNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(workOrder.status),
  );
  const canReview = Boolean(
    workOrder &&
    workOrder.status === "SUBMITTED" &&
    (workOrder.reviewer?.id === agency?.membershipId || hasAnyRole(roleKeys, ["OWNER", "ADMIN", "MANAGER"])),
  );
  const hasSubmissionInput = Boolean(submissionDraft.body.trim() || submissionDraft.externalLink.trim());

  const submit = async () => {
    if (!agencyId || !workOrder || !hasSubmissionInput) return;
    setIsRunning(true);
    setError(null);
    try {
      const updated = await submitWorkOrder(agencyId, workOrder.id, {
        body: submissionDraft.body.trim() || undefined,
        externalLink: submissionDraft.externalLink.trim() || undefined,
      });
      setWorkOrder(updated);
      setSubmissionDraft({ body: "", externalLink: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit gig.");
    } finally {
      setIsRunning(false);
    }
  };

  const approve = async () => {
    if (!agencyId || !workOrder) return;
    setIsRunning(true);
    setError(null);
    try {
      const updated = await approveWorkOrder(agencyId, workOrder.id, {
        comment: reviewComment.trim() || undefined,
      });
      setWorkOrder(updated);
      setReviewComment("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve gig.");
    } finally {
      setIsRunning(false);
    }
  };

  const requestChanges = async () => {
    if (!agencyId || !workOrder || !reviewComment.trim()) return;
    setIsRunning(true);
    setError(null);
    try {
      const updated = await requestWorkOrderChanges(agencyId, workOrder.id, {
        comment: reviewComment.trim(),
      });
      setWorkOrder(updated);
      setReviewComment("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to request changes.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/${agencySlug}/gigs`)}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white lg:rounded-full"
          >
            ←
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Gig</p>
            <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl lg:text-3xl">{workOrder?.title || (isLoading ? "Loading..." : "Gig")}</h1>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-lg shadow-black/10 lg:rounded-3xl lg:p-5 lg:shadow-2xl">
        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading gig...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : workOrder ? (
          <div className="space-y-3 lg:space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={statusPillClasses(workOrder.workType, "sm")}>{formatLabel(workOrder.workType)}</span>
              <span className={statusPillClasses(workOrder.status, "sm")}>{formatLabel(workOrder.status)}</span>
              <span className={statusPillClasses(workOrder.priority, "sm")}>{formatLabel(workOrder.priority)}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Detail label="Client" value={workOrder.client?.name || "No client"} />
              <Detail label="Assignee" value={workOrder.assignee?.name} />
              <Detail label="Reviewer" value={workOrder.reviewer?.name || "Manager"} />
              <Detail label="Due" value={formatDateTime(workOrder.dueAt)} />
            </div>

            <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-2xl lg:p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Instructions</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{workOrder.description}</p>
            </section>

            <LatestSubmission workOrder={workOrder} />

            {canSubmit ? (
              <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-2xl lg:p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Submit work</h2>
                <div className="mt-3 grid gap-3">
                  <input
                    value={submissionDraft.externalLink}
                    onChange={(event) => setSubmissionDraft((current) => ({ ...current, externalLink: event.target.value }))}
                    placeholder="Google Doc, Drive, Frame.io, or reference link"
                    className="min-h-11 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-base text-white outline-none transition focus:border-indigo-500 lg:rounded-2xl lg:text-sm"
                  />
                  <textarea
                    value={submissionDraft.body}
                    onChange={(event) => setSubmissionDraft((current) => ({ ...current, body: event.target.value }))}
                    rows={4}
                    placeholder="Notes, script, handoff details, or anything the reviewer should know"
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition focus:border-indigo-500 lg:rounded-2xl lg:text-sm"
                  />
                  <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex justify-end bg-[#0b0b11] py-1 lg:static lg:py-0">
                    <button
                      type="button"
                      disabled={isRunning || !hasSubmissionInput}
                      onClick={submit}
                      className="min-h-11 w-full rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:rounded-full"
                    >
                      {isRunning ? "Submitting..." : "Submit for review"}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {canReview ? (
              <section className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-2xl lg:p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Review submission</h2>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={3}
                  placeholder="Review comment or change request reason"
                  className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition focus:border-indigo-500 lg:rounded-2xl lg:text-sm"
                />
                <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 mt-3 grid grid-cols-2 gap-2 bg-[#0b0b11] py-1 lg:static lg:flex lg:py-0">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={approve}
                    className="min-h-11 rounded-md bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={isRunning || !reviewComment.trim()}
                    onClick={requestChanges}
                    className="min-h-11 rounded-md border border-red-500/30 bg-red-500/10 px-5 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full"
                  >
                    Request changes
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LatestSubmission({ workOrder }: { workOrder: WorkOrder }) {
  const latest = workOrder.submissions[0];
  if (!latest) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-800 bg-[#0b0b11] p-4 text-sm text-zinc-500">
        No submissions yet.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Latest submission</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={statusPillClasses(latest.status)}>{formatLabel(latest.status)}</span>
            <span className="text-xs text-zinc-600">v{latest.version}</span>
            <span className="text-xs text-zinc-600">by {latest.submittedBy?.name || "Unknown"}</span>
          </div>
        </div>
        <div className="text-xs text-zinc-600">{formatDateTime(latest.createdAt)}</div>
      </div>
      <div className="mt-4 grid gap-3">
        {latest.externalLink ? (
          <a
            href={latest.externalLink}
            target="_blank"
            rel="noreferrer"
            className="break-all rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:text-indigo-200"
          >
            {latest.externalLink}
          </a>
        ) : null}
        {latest.body ? (
          <p className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-300">{latest.body}</p>
        ) : null}
        {latest.reviewComment ? (
          <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
            {latest.reviewComment}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-[#0b0b11] p-3 lg:rounded-2xl lg:p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-2 truncate text-sm text-zinc-200">{value || "—"}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasAnyRole(roleKeys: string[], allowed: string[]) {
  return roleKeys.some((roleKey) => allowed.includes(roleKey));
}
