"use client";

import { ClipboardList, ExternalLink, Plus, Save } from "lucide-react";
import {
  useMemo,
  useState,
  type ClipboardEvent,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  createPublishingSchedule,
  updatePublishingSchedule,
  type Campaign,
  type CampaignAssignmentRole,
  type CampaignTeamAssignment,
  type PublishingSchedule,
  type PublishingScheduleAgendaResponse,
} from "@/lib/api/campaigns";
import {
  createContentAsset,
  updateContentPlanningFields,
  updateContentAsset,
  type ContentAsset,
} from "@/lib/api/content";
import type { WorkflowBoardItem } from "@/lib/api/workflow";
import {
  invalidateWorkspaceQueries,
  queryKeys,
  setListItem,
  useCampaignContentQuery,
  useWorkflowQuery,
} from "@/lib/query";
import { publishingPlatformOptions } from "@/lib/campaign-options";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { getWorkspaceHref } from "@/lib/workspace-url";

const contentTypeOptions = [
  "REEL",
  "CAROUSEL",
  "STATIC",
  "STORY",
  "BLOG",
  "YOUTUBE",
  "AD",
  "OTHER",
];

type DraftRow = {
  id: string;
  title: string;
  type: string;
  brief: string;
  platform: string;
  assigneeId: string;
  dueDate: string;
  publishDate: string;
};

type PlanValues = Omit<DraftRow, "id">;

type PlanMemberOption = {
  id: string;
  name: string;
  roleSummary?: string;
};

const visibleProductionRoles: Array<{
  key: "WRITER" | "DOP" | "EDITOR" | "REVIEWER";
  label: string;
  assignmentRoles: CampaignAssignmentRole[];
}> = [
  { key: "WRITER", label: "Writer", assignmentRoles: ["WRITER"] },
  { key: "DOP", label: "DOP", assignmentRoles: ["DOP"] },
  { key: "EDITOR", label: "Editor", assignmentRoles: ["EDITOR"] },
  {
    key: "REVIEWER",
    label: "Reviewer",
    assignmentRoles: [
      "CAMPAIGN_MANAGER",
      "RELATIONSHIP_MANAGER",
      "AGENCY_APPROVER",
      "CLIENT_APPROVER",
    ],
  },
];

export function CampaignContentPlan({
  campaign,
  agencyId,
  agencySlug,
  agenda,
  campaignTeam,
  canManage,
  onChanged,
}: {
  campaign: Campaign;
  agencyId: string;
  agencySlug: string;
  agenda: PublishingScheduleAgendaResponse | null;
  campaignTeam: CampaignTeamAssignment[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const contentQuery = useCampaignContentQuery(agencyId, campaign.id);
  const workflowQuery = useWorkflowQuery(agencyId, { campaignId: campaign.id });
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [draftCounter, setDraftCounter] = useState(1);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const contentAssets = contentQuery.data ?? [];
  const memberOptions = useMemo(
    () => campaignTeamMemberOptions(campaignTeam),
    [campaignTeam],
  );
  const workflowByAssetId = useMemo(
    () => buildWorkflowMap(workflowQuery.data?.columns.flatMap((column) => column.items) ?? []),
    [workflowQuery.data],
  );
  const scheduleByAssetId = useMemo(
    () => buildScheduleMap(agenda?.items ?? []),
    [agenda?.items],
  );

  const invalidatePlan = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaignContent(agencyId, campaign.id),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.content(agencyId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(agencyId, campaign.id),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.publishingSchedules(agencyId, campaign.id),
      }),
    ]);
    invalidateWorkspaceQueries(queryClient, agencyId, [
      "dashboard",
      "workflow",
      "calendar",
      "schedule",
      "content",
      "campaigns",
    ]);
    await onChanged();
  };

  const addDraftRows = (count = 1, titles: string[] = []) => {
    const nextRows = Array.from({ length: Math.max(count, titles.length) }).map(
      (_, index) => ({
        id: `draft-${draftCounter + index}`,
        title: titles[index] ?? "",
        type: "REEL",
        brief: "",
        platform: "",
        assigneeId: "",
        dueDate: "",
        publishDate: "",
      }),
    );
    setDraftCounter((value) => value + nextRows.length);
    setDraftRows((current) => [...current, ...nextRows]);
  };

  const saveDraft = async (draft: DraftRow) => {
    const title = draft.title.trim();
    if (!title) throw new Error("Title is required.");

    const asset = await createContentAsset(agencyId, {
      campaignId: campaign.id,
      clientId: campaign.clientId,
      title,
      type: draft.type,
      brief: draft.brief.trim() || `Planning brief for ${title}`,
      assigneeId: draft.assigneeId || null,
      deadlineAt: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
    });

    queryClient.setQueryData(queryKeys.contentAsset(agencyId, asset.id), asset);
    queryClient.setQueryData(
      queryKeys.content(agencyId),
      (current: ContentAsset[] | undefined) => setListItem(current, asset),
    );

    if (draft.publishDate) {
      await createPublishingSchedule(agencyId, campaign.id, {
        platform: draft.platform || "INSTAGRAM",
        scheduledAt: new Date(draft.publishDate).toISOString(),
        timezone: campaign.timezone || "Asia/Kolkata",
        contentAssetId: asset.id,
      });
    }

    setDraftRows((current) => current.filter((row) => row.id !== draft.id));
    await invalidatePlan();
  };

  const saveAllDrafts = async () => {
    const rowsToSave = draftRows.filter((row) => row.title.trim()).slice(0, 10);
    if (!rowsToSave.length) return;

    setSavingDrafts(true);
    setBulkError(null);
    try {
      for (const row of rowsToSave) {
        await saveDraft(row);
      }
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "Failed to save draft rows.",
      );
    } finally {
      setSavingDrafts(false);
    }
  };

  const saveExisting = async (
    asset: ContentAsset,
    schedule: PublishingSchedule | null,
    values: PlanValues,
  ) => {
    const title = values.title.trim();
    if (!title) throw new Error("Title is required.");

    const updatedAsset = await updateContentAsset(agencyId, asset.id, {
      title,
      type: values.type,
      brief: values.brief,
    });

    queryClient.setQueryData(
      queryKeys.contentAsset(agencyId, asset.id),
      updatedAsset,
    );
    queryClient.setQueryData(
      queryKeys.content(agencyId),
      (current: ContentAsset[] | undefined) =>
        setListItem(current, updatedAsset),
    );

    if (values.publishDate) {
      if (schedule?.id && schedule.version) {
        await updatePublishingSchedule(agencyId, campaign.id, schedule.id, {
          platform: values.platform || schedule.platform || "INSTAGRAM",
          scheduledAt: new Date(values.publishDate).toISOString(),
          timezone: campaign.timezone || schedule.timezone || "Asia/Kolkata",
          contentAssetId: asset.id,
          version: schedule.version,
        });
      } else {
        await createPublishingSchedule(agencyId, campaign.id, {
          platform: values.platform || "INSTAGRAM",
          scheduledAt: new Date(values.publishDate).toISOString(),
          timezone: campaign.timezone || "Asia/Kolkata",
          contentAssetId: asset.id,
        });
      }
    }

    if (values.assigneeId || values.dueDate) {
      const plannedAsset = await updateContentPlanningFields(agencyId, asset.id, {
        assigneeId: values.assigneeId || null,
        deadlineAt: values.dueDate
          ? new Date(values.dueDate).toISOString()
          : null,
      });
      queryClient.setQueryData(
        queryKeys.contentAsset(agencyId, asset.id),
        plannedAsset,
      );
    }

    await invalidatePlan();
  };

  const openWorkflow = (contentId: string) => {
    router.push(getWorkspaceHref(agencySlug, `/workflow/${contentId}`));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <ClipboardList className="h-3.5 w-3.5" />
            Content Plan
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Plan what this campaign is producing.
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
            Plan reels, posts, carousels, shoots, and publishing dates in one place.
            Shoot and production due dates are not persisted on content assets yet.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addDraftRows(1)}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Content
            </button>
            <button
              type="button"
              onClick={() => addDraftRows(5)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Add 5 Rows
            </button>
          </div>
        ) : null}
      </div>

      {!canManage ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          You can view this campaign content plan, but editing is limited to
          campaign owners, admins, and managers.
        </div>
      ) : null}

      {contentQuery.isLoading && !contentQuery.data ? (
        <div className="mt-4 text-xs text-slate-500">Loading content plan...</div>
      ) : contentQuery.error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          Failed to load campaign content.
        </div>
      ) : !contentAssets.length && !draftRows.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center">
          <h3 className="text-base font-semibold text-slate-950">
            Start building this campaign&apos;s content plan.
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Plan reels, posts, carousels, shoots, and publishing dates in one place.
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={() => addDraftRows(1)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />
              Add Content
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="hidden md:block">
            <div className="space-y-2">
              {draftRows.map((draft) => (
                <DraftPlanRow
                  key={draft.id}
                  draft={draft}
                  members={memberOptions}
                  campaignTeam={campaignTeam}
                  canManage={canManage}
                  onChange={(next) =>
                    setDraftRows((current) =>
                      current.map((row) =>
                        row.id === draft.id ? { ...row, ...next } : row,
                      ),
                    )
                  }
                  onPasteTitles={(titles) => addDraftRows(titles.length, titles)}
                  onRemove={() =>
                    setDraftRows((current) =>
                      current.filter((row) => row.id !== draft.id),
                    )
                  }
                  onSave={() => saveDraft(draft)}
                />
              ))}
              {contentAssets.map((asset) => (
                <ExistingPlanRow
                  key={asset.id}
                  asset={asset}
                  schedule={scheduleByAssetId.get(asset.id) ?? null}
                  workflowItem={workflowByAssetId.get(asset.id) ?? null}
                  members={memberOptions}
                  campaignTeam={campaignTeam}
                  canManage={canManage}
                  onOpen={() => openWorkflow(asset.id)}
                  onSave={saveExisting}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {draftRows.map((draft) => (
              <DraftPlanCard
                key={draft.id}
                draft={draft}
                members={memberOptions}
                campaignTeam={campaignTeam}
                canManage={canManage}
                onChange={(next) =>
                  setDraftRows((current) =>
                    current.map((row) =>
                      row.id === draft.id ? { ...row, ...next } : row,
                    ),
                  )
                }
                onPasteTitles={(titles) => addDraftRows(titles.length, titles)}
                onRemove={() =>
                  setDraftRows((current) =>
                    current.filter((row) => row.id !== draft.id),
                  )
                }
                onSave={() => saveDraft(draft)}
              />
            ))}
            {contentAssets.map((asset) => (
              <ExistingPlanCard
                key={asset.id}
                asset={asset}
                schedule={scheduleByAssetId.get(asset.id) ?? null}
                workflowItem={workflowByAssetId.get(asset.id) ?? null}
                members={memberOptions}
                campaignTeam={campaignTeam}
                canManage={canManage}
                onOpen={() => openWorkflow(asset.id)}
                onSave={saveExisting}
              />
            ))}
          </div>
        </div>
      )}

      {draftRows.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-500">
            Paste multiple titles line by line into a draft title cell to add
            rows. Bulk save is capped at 10 rows per click.
          </p>
          <button
            type="button"
            disabled={savingDrafts || !draftRows.some((row) => row.title.trim())}
            onClick={saveAllDrafts}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {savingDrafts ? "Saving..." : "Save Draft Rows"}
          </button>
        </div>
      ) : null}

      {bulkError ? (
        <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {bulkError}
        </div>
      ) : null}
    </section>
  );
}

function DraftPlanRow({
  draft,
  members,
  campaignTeam,
  canManage,
  onChange,
  onPasteTitles,
  onRemove,
  onSave,
}: {
  draft: DraftRow;
  members: PlanMemberOption[];
  campaignTeam: CampaignTeamAssignment[];
  canManage: boolean;
  onChange: (next: Partial<DraftRow>) => void;
  onPasteTitles: (titles: string[]) => void;
  onRemove: () => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save row.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="grid gap-2 lg:grid-cols-[minmax(180px,2fr)_105px_135px_minmax(150px,1.1fr)_auto]">
        <PlanField label="Title">
          <TextInput
            value={draft.title}
            disabled={!canManage || isSaving}
            placeholder="Content title"
            onChange={(title) => onChange({ title })}
            onPasteTitles={onPasteTitles}
          />
        </PlanField>
        <PlanField label="Type">
          <TypeSelect
            value={draft.type}
            disabled={!canManage || isSaving}
            onChange={(type) => onChange({ type })}
          />
        </PlanField>
        <PlanField label="Platform">
          <PlatformSelect
            value={draft.platform}
            disabled={!canManage || isSaving}
            onChange={(platform) => onChange({ platform })}
          />
        </PlanField>
        <PlanField label="Owner override">
          <OwnerSelect
            members={members}
            value={draft.assigneeId}
            disabled={!canManage || isSaving}
            onChange={(assigneeId) => onChange({ assigneeId })}
          />
        </PlanField>
        <div className="flex items-end justify-end gap-1.5">
          <button
            type="button"
            disabled={!canManage || isSaving || !draft.title.trim()}
            onClick={save}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onRemove}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-[155px_155px_minmax(220px,1fr)_minmax(280px,1.1fr)_105px]">
        <PlanField label="Due date">
          <DateInput
            value={draft.dueDate}
            disabled={!canManage || isSaving}
            onChange={(dueDate) => onChange({ dueDate })}
          />
        </PlanField>
        <PlanField label="Publish date">
          <DateInput
            value={draft.publishDate}
            disabled={!canManage || isSaving}
            onChange={(publishDate) => onChange({ publishDate })}
          />
        </PlanField>
        <PlanField label="Brief">
          <TextArea
            value={draft.brief}
            disabled={!canManage || isSaving}
            placeholder="Brief or notes"
            onChange={(brief) => onChange({ brief })}
          />
        </PlanField>
        <PlanField label="Team roles">
          <ResponsibilityStrip
            campaignTeam={campaignTeam}
            writerOverrideId={draft.assigneeId || null}
          />
        </PlanField>
        <PlanField label="Status">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Draft
          </span>
        </PlanField>
      </div>
      {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
    </div>
  );
}

function ExistingPlanRow({
  asset,
  schedule,
  workflowItem,
  members,
  campaignTeam,
  canManage,
  onOpen,
  onSave,
}: {
  asset: ContentAsset;
  schedule: PublishingSchedule | null;
  workflowItem: WorkflowBoardItem | null;
  members: PlanMemberOption[];
  campaignTeam: CampaignTeamAssignment[];
  canManage: boolean;
  onOpen: () => void;
  onSave: (
    asset: ContentAsset,
    schedule: PublishingSchedule | null,
    values: PlanValues,
  ) => Promise<void>;
}) {
  const [values, setValues] = useState<PlanValues>(() =>
    valuesFromAsset(asset, schedule, workflowItem),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(asset, schedule, values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save row.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 transition hover:border-slate-300 hover:bg-white">
      <div className="grid gap-2 lg:grid-cols-[minmax(180px,2fr)_105px_135px_minmax(150px,1.1fr)_auto]">
        <PlanField label="Title">
          <TextInput
            value={values.title}
            disabled={!canManage || isSaving}
            placeholder="Content title"
            onChange={(title) => setValues((current) => ({ ...current, title }))}
          />
        </PlanField>
        <PlanField label="Type">
          <TypeSelect
            value={values.type}
            disabled={!canManage || isSaving}
            onChange={(type) => setValues((current) => ({ ...current, type }))}
          />
        </PlanField>
        <PlanField label="Platform">
          <PlatformSelect
            value={values.platform}
            disabled={!canManage || isSaving}
            onChange={(platform) =>
              setValues((current) => ({ ...current, platform }))
            }
          />
        </PlanField>
        <PlanField label="Owner override">
          <OwnerSelect
            members={members}
            value={values.assigneeId}
            disabled={!canManage || isSaving}
            onChange={(assigneeId) =>
              setValues((current) => ({ ...current, assigneeId }))
            }
          />
        </PlanField>
        <div className="flex items-end justify-end gap-1.5">
          {canManage ? (
            <button
              type="button"
              disabled={isSaving || !values.title.trim()}
              onClick={save}
              className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving" : "Save"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Workflow
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-[155px_155px_minmax(220px,1fr)_minmax(280px,1.1fr)_105px]">
        <PlanField label="Due date">
          <DateInput
            value={values.dueDate}
            disabled={!canManage || isSaving}
            onChange={(dueDate) =>
              setValues((current) => ({ ...current, dueDate }))
            }
          />
        </PlanField>
        <PlanField label="Publish date">
          <DateInput
            value={values.publishDate}
            disabled={!canManage || isSaving}
            onChange={(publishDate) =>
              setValues((current) => ({ ...current, publishDate }))
            }
          />
        </PlanField>
        <PlanField label="Brief">
          <TextArea
            value={values.brief}
            disabled={!canManage || isSaving}
            placeholder="Brief or notes"
            onChange={(brief) => setValues((current) => ({ ...current, brief }))}
          />
        </PlanField>
        <PlanField label="Team roles">
          <ResponsibilityStrip
            campaignTeam={campaignTeam}
            writerOverrideId={values.assigneeId || null}
          />
        </PlanField>
        <PlanField label="Status">
          <span className={statusPillClasses(workflowItem?.stage || asset.stage || asset.status, "sm")}>
            {formatLabel(workflowItem?.stage || asset.stage || asset.status)}
          </span>
        </PlanField>
      </div>
      {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
    </div>
  );
}

function DraftPlanCard(props: ComponentProps<typeof DraftPlanRow>) {
  const { draft, members, campaignTeam, canManage, onChange, onPasteTitles, onRemove, onSave } = props;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save row.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="space-y-2">
        <TextInput
          value={draft.title}
          disabled={!canManage || isSaving}
          placeholder="Content title"
          onChange={(title) => onChange({ title })}
          onPasteTitles={onPasteTitles}
        />
        <div className="grid grid-cols-2 gap-2">
          <TypeSelect
            value={draft.type}
            disabled={!canManage || isSaving}
            onChange={(type) => onChange({ type })}
          />
          <PlatformSelect
            value={draft.platform}
            disabled={!canManage || isSaving}
            onChange={(platform) => onChange({ platform })}
          />
        </div>
        <OwnerSelect
          members={members}
          value={draft.assigneeId}
          disabled={!canManage || isSaving}
          onChange={(assigneeId) => onChange({ assigneeId })}
        />
        <ResponsibilityStrip
          campaignTeam={campaignTeam}
          writerOverrideId={draft.assigneeId || null}
        />
        <DateInput
          value={draft.dueDate}
          disabled={!canManage || isSaving}
          onChange={(dueDate) => onChange({ dueDate })}
        />
        <DateInput
          value={draft.publishDate}
          disabled={!canManage || isSaving}
          onChange={(publishDate) => onChange({ publishDate })}
        />
        <TextArea
          value={draft.brief}
          disabled={!canManage || isSaving}
          placeholder="Brief or notes"
          onChange={(brief) => onChange({ brief })}
        />
      </div>
      {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!canManage || isSaving || !draft.title.trim()}
          onClick={save}
          className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onRemove}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function ExistingPlanCard(props: ComponentProps<typeof ExistingPlanRow>) {
  const { asset, schedule, workflowItem, members, campaignTeam, canManage, onOpen, onSave } = props;
  const [values, setValues] = useState<PlanValues>(() =>
    valuesFromAsset(asset, schedule, workflowItem),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(asset, schedule, values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save row.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={statusPillClasses(asset.stage || asset.status, "sm")}>
          {formatLabel(workflowItem?.stage || asset.stage || asset.status)}
        </span>
        <span className="text-xs text-slate-500">
          {workflowItem?.owner?.name || "No owner"}
        </span>
      </div>
      <div className="space-y-2">
        <TextInput
          value={values.title}
          disabled={!canManage || isSaving}
          placeholder="Content title"
          onChange={(title) => setValues((current) => ({ ...current, title }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <TypeSelect
            value={values.type}
            disabled={!canManage || isSaving}
            onChange={(type) => setValues((current) => ({ ...current, type }))}
          />
          <PlatformSelect
            value={values.platform}
            disabled={!canManage || isSaving}
            onChange={(platform) =>
              setValues((current) => ({ ...current, platform }))
            }
          />
        </div>
        <OwnerSelect
          members={members}
          value={values.assigneeId}
          disabled={!canManage || isSaving}
          onChange={(assigneeId) =>
            setValues((current) => ({ ...current, assigneeId }))
          }
        />
        <ResponsibilityStrip
          campaignTeam={campaignTeam}
          writerOverrideId={values.assigneeId || null}
        />
        <DateInput
          value={values.dueDate}
          disabled={!canManage || isSaving}
          onChange={(dueDate) =>
            setValues((current) => ({ ...current, dueDate }))
          }
        />
        <DateInput
          value={values.publishDate}
          disabled={!canManage || isSaving}
          onChange={(publishDate) =>
            setValues((current) => ({ ...current, publishDate }))
          }
        />
        <TextArea
          value={values.brief}
          disabled={!canManage || isSaving}
          placeholder="Brief or notes"
          onChange={(brief) => setValues((current) => ({ ...current, brief }))}
        />
      </div>
      {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
      <div className="mt-3 flex gap-2">
        {canManage ? (
          <button
            type="button"
            disabled={isSaving || !values.title.trim()}
            onClick={save}
            className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving" : "Save"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <ExternalLink className="h-3 w-3" />
          Workflow
        </button>
      </div>
    </div>
  );
}

function PlanField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  disabled,
  placeholder,
  onChange,
  onPasteTitles,
}: {
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onPasteTitles?: (titles: string[]) => void;
}) {
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    const titles = parsePastedTitles(text);
    if (titles.length <= 1 || !onPasteTitles) return;
    event.preventDefault();
    onChange(titles[0]);
    onPasteTitles(titles.slice(1));
  };

  return (
    <input
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onPaste={onPaste}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

function TextArea({
  value,
  disabled,
  placeholder,
  onChange,
}: {
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      rows={2}
      onChange={(event) => onChange(event.target.value)}
      className="sm:min-h-9 min-h-12 w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

function TypeSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    >
      {contentTypeOptions.map((option) => (
        <option key={option} value={option}>
          {formatLabel(option)}
        </option>
      ))}
    </select>
  );
}

function PlatformSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    >
      <option value="">With publish date</option>
      {publishingPlatformOptions.map((option) => (
        <option key={option} value={option}>
          {formatLabel(option)}
        </option>
      ))}
    </select>
  );
}

function OwnerSelect({
  members,
  value,
  disabled,
  onChange,
}: {
  members: PlanMemberOption[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    >
      <option value="">Use campaign team default</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.roleSummary ? `${member.name} · ${member.roleSummary}` : member.name}
        </option>
      ))}
    </select>
  );
}

function ResponsibilityStrip({
  campaignTeam,
  writerOverrideId,
}: {
  campaignTeam: CampaignTeamAssignment[];
  writerOverrideId?: string | null;
}) {
  return (
    <div className="grid min-h-9 grid-cols-2 gap-1.5 xl:grid-cols-4">
      {visibleProductionRoles.map((role) => {
        const state = productionRoleState(campaignTeam, role, writerOverrideId);
        return (
          <span
            key={role.key}
            className={`min-w-0 rounded-md border px-2 py-1 text-[11px] leading-4 ${state.className}`}
            title={`${role.label}: ${state.detail}`}
          >
            <span className="block truncate font-semibold">{role.label}</span>
            <span className="block truncate">{state.detail}</span>
          </span>
        );
      })}
    </div>
  );
}

function DateInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="datetime-local"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="date-input h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

function buildScheduleMap(schedules: PublishingSchedule[]) {
  const map = new Map<string, PublishingSchedule>();
  schedules
    .filter(
      (schedule) =>
        schedule.contentAssetId &&
        !["CANCELLED", "MISSED"].includes(schedule.status || ""),
    )
    .forEach((schedule) => {
      const contentAssetId = schedule.contentAssetId!;
      const existing = map.get(contentAssetId);
      if (
        !existing ||
        new Date(schedule.scheduledAt).getTime() <
          new Date(existing.scheduledAt).getTime()
      ) {
        map.set(contentAssetId, schedule);
      }
    });
  return map;
}

function buildWorkflowMap(items: WorkflowBoardItem[]) {
  return new Map(items.map((item) => [item.contentAssetId, item]));
}

function campaignTeamMemberOptions(
  assignments: CampaignTeamAssignment[],
): PlanMemberOption[] {
  const byMembershipId = new Map<string, PlanMemberOption & { roles: Set<string> }>();

  assignments.forEach((assignment) => {
    const name = campaignAssignmentMemberName(assignment);
    const current = byMembershipId.get(assignment.membershipId) ?? {
      id: assignment.membershipId,
      name,
      roles: new Set<string>(),
    };
    current.roles.add(formatLabel(assignment.assignmentRole));
    byMembershipId.set(assignment.membershipId, current);
  });

  return [...byMembershipId.values()].map(({ roles, ...member }) => ({
    ...member,
    roleSummary: [...roles].join(", "),
  }));
}

function productionRoleState(
  assignments: CampaignTeamAssignment[],
  role: (typeof visibleProductionRoles)[number],
  writerOverrideId?: string | null,
) {
  const matching = assignments.filter((assignment) =>
    role.assignmentRoles.includes(assignment.assignmentRole),
  );

  if (role.key === "WRITER" && writerOverrideId) {
    const inherited =
      matching.length === 1 ? matching[0].membershipId : null;
    return {
      detail:
        writerOverrideId === inherited
          ? `${campaignAssignmentMemberName(matching[0])} inherited`
          : `${memberNameById(assignments, writerOverrideId)} override`,
      className:
        writerOverrideId === inherited
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  if (!matching.length) {
    return {
      detail: `${role.label} required`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (matching.length > 1) {
    return {
      detail: `Multiple ${role.label.toLowerCase()}s`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    detail: `${campaignAssignmentMemberName(matching[0])} inherited`,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function memberNameById(assignments: CampaignTeamAssignment[], membershipId: string) {
  const assignment = assignments.find((item) => item.membershipId === membershipId);
  return assignment ? campaignAssignmentMemberName(assignment) : "Selected owner";
}

function campaignAssignmentMemberName(assignment: CampaignTeamAssignment) {
  return (
    assignment.membership.name ||
    assignment.membership.user?.name ||
    assignment.membership.user?.email ||
    "Unnamed member"
  );
}

function valuesFromAsset(
  asset: ContentAsset,
  schedule: PublishingSchedule | null,
  workflowItem: WorkflowBoardItem | null,
): PlanValues {
  return {
    title: asset.title || "",
    type: asset.type || "REEL",
    brief: asset.brief || "",
    platform: schedule?.platform || "",
    assigneeId: workflowItem?.owner?.membershipId || "",
    dueDate: toDateTimeInput(workflowItem?.deadlineAt),
    publishDate: toDateTimeInput(schedule?.scheduledAt),
  };
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

function parsePastedTitles(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}
