"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CampaignPlanForm } from "@/components/CampaignPlanForm";
import { CampaignContentPlan } from "@/components/CampaignContentPlan";
import { useAgency } from "@/components/AgencyProvider";
import {
  activateCampaign,
  archiveCampaign,
  assignCampaignTeamMember,
  cancelPublishingSchedule,
  Campaign,
  CampaignActivityItem,
  CampaignActivityResponse,
  CampaignAssignmentRole,
  CampaignDeliverablePlan,
  CampaignTeamAssignment,
  completeCampaign,
  createPublishingSchedule,
  CreateCampaignInput,
  generatePublishingProduction,
  getCampaignActivity,
  getCampaign,
  getCampaignTeam,
  getPublishingSchedules,
  markPublishingSchedulePublished,
  pauseCampaign,
  PublishingSchedule,
  PublishingScheduleAgendaResponse,
  removeCampaignTeamAssignment,
  restoreCampaign,
  resumeCampaign,
  updatePublishingSchedule,
  updateCampaign,
} from "@/lib/api/campaigns";
import { Client, getClients } from "@/lib/api/clients";
import { getMembers, Member } from "@/lib/api/team";
import { publishingPlatformOptions } from "@/lib/campaign-options";
import { statusPillClasses } from "@/lib/status-style";
import { invalidateWorkspaceQueries, queryKeys, setListItem } from "@/lib/query";
import { getWorkspaceHref } from "@/lib/workspace-url";
import {
  clearRememberedEntityId,
  rememberedEntityKey,
  rememberedTabKey,
  useRememberLastVisitedEntity,
  useRememberedTab,
} from "@/lib/remembered-tab";
import { useDialog } from "@/components/ui/DialogProvider";
const assignmentRoleOrder: CampaignAssignmentRole[] = [
  "CAMPAIGN_MANAGER",
  "RELATIONSHIP_MANAGER",
  "WRITER",
  "EDITOR",
  "DESIGNER",
  "DOP",
  "SOCIAL_MEDIA_MANAGER",
  "CLIENT_APPROVER",
  "AGENCY_APPROVER",
];

type CampaignTab = "overview" | "content" | "schedule" | "team" | "activity";

const campaignTabs: CampaignTab[] = ["overview", "content", "schedule", "team", "activity"];

export default function CampaignDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ campaignId: string }>();
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const { agencyId, agencySlug, agency } = useAgency();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<CampaignTeamAssignment[]>([]);
  const [activityItems, setActivityItems] = useState<CampaignActivityItem[]>([]);
  const [publishingAgenda, setPublishingAgenda] = useState<PublishingScheduleAgendaResponse | null>(null);
  const [deliverables, setDeliverables] = useState<CampaignDeliverablePlan[]>([]);
  const [schedules, setSchedules] = useState<PublishingSchedule[]>([]);
  const [activeTab, setActiveTab] = useRememberedTab<CampaignTab>({
    defaultTab: "overview",
    storageKey: agencyId
      ? rememberedTabKey("campaign", agencyId, params.campaignId)
      : null,
    urlTab: searchParams.get("tab"),
    validTabs: campaignTabs,
  });
  useRememberLastVisitedEntity({
    storageKey: rememberedEntityKey("campaign", agencyId),
    entityId: campaign?.id,
    enabled: Boolean(campaign),
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isManagingTeam, setIsManagingTeam] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const safeAgencySlug = agencySlug ?? "";
  const { register, handleSubmit, reset, formState } = useForm<CreateCampaignInput>({
    mode: "onChange",
  });

  useEffect(() => {
    if (!agencyId || !params.campaignId) return;
    let isMounted = true;

    Promise.all([
      getCampaign(agencyId, params.campaignId),
      getClients(agencyId),
      getMembers(agencyId),
      getCampaignTeam(agencyId, params.campaignId),
      getCampaignActivity(agencyId, params.campaignId),
      getPublishingSchedules(agencyId, params.campaignId),
    ])
      .then(([campaignData, clientData, memberData, teamData, activityData, agendaData]) => {
        if (!isMounted) return;
        setClients(clientData);
        setMembers(memberData);
        setTeamAssignments(teamData);
        setActivityItems(activityData.items);
        setPublishingAgenda(agendaData);
        hydrateCampaign(campaignData, reset, setDeliverables, setSchedules);
        setCampaign(campaignData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load campaign.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId, params.campaignId, reset]);

  const metrics = useMemo(() => getCampaignMetrics(campaign), [campaign]);
  const structuredTeam = useMemo(() => groupAssignments(teamAssignments), [teamAssignments]);
  const canEditCampaign = canViewFullCampaign(agency?.role, agency?.roles);
  const canManageCampaignTeam = canManageTeam(agency?.role, agency?.roles, agency?.membershipId, teamAssignments);
  const canViewOperationalFields = canEditCampaign || canManageCampaignTeam;

  const save = async (data: CreateCampaignInput) => {
    if (!agencyId || !campaign) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateCampaign(agencyId, campaign.id, {
        ...buildPayload(data, deliverables, schedules),
        version: campaign.version,
      });
      hydrateCampaign(updated, reset, setDeliverables, setSchedules);
      setCampaign(updated);
      cacheCampaign(queryClient, agencyId, updated);
      const [activity, agenda] = await Promise.all([
        getCampaignActivity(agencyId, campaign.id),
        getPublishingSchedules(agencyId, campaign.id),
      ]);
      setActivityItems(activity.items);
      setPublishingAgenda(agenda);
      cacheCampaignActivity(queryClient, agencyId, campaign.id, activity);
      cachePublishingAgenda(queryClient, agencyId, campaign.id, agenda);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save campaign.");
    } finally {
      setIsSaving(false);
    }
  };

  const activate = async () => {
    if (!agencyId || !campaign) return;

    const confirmed = await dialog.confirm({
      title: "Activate Campaign",
      description: `Mark ${campaign.name} as active?`,
      confirmText: "Activate",
    });
    if (!confirmed) return;

    setIsActivating(true);
    setError(null);
    try {
      const updated = await activateCampaign(agencyId, campaign.id, campaign.version);
      hydrateCampaign(updated, reset, setDeliverables, setSchedules);
      setCampaign(updated);
      cacheCampaign(queryClient, agencyId, updated);
      const [activity, agenda] = await Promise.all([
        getCampaignActivity(agencyId, campaign.id),
        getPublishingSchedules(agencyId, campaign.id),
      ]);
      setActivityItems(activity.items);
      setPublishingAgenda(agenda);
      cacheCampaignActivity(queryClient, agencyId, campaign.id, activity);
      cachePublishingAgenda(queryClient, agencyId, campaign.id, agenda);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate campaign.");
    } finally {
      setIsActivating(false);
    }
  };

  const runStatusAction = async (label: string, action: () => Promise<Campaign>) => {
    const isDestructive = label.toLowerCase().includes("archive") || label.toLowerCase().includes("delete");
    const confirmed = await dialog.confirm({
      title: `${label} Campaign`,
      description: `Are you sure you want to ${label.toLowerCase()} ${campaign?.name}?`,
      confirmText: label,
      variant: isDestructive ? "danger" : "default",
    });
    if (!confirmed) return;

    setIsActivating(true);
    setError(null);
    try {
      const updated = await action();
      hydrateCampaign(updated, reset, setDeliverables, setSchedules);
      setCampaign(updated);
      if (agencyId) cacheCampaign(queryClient, agencyId, updated);
      if (agencyId && campaign) {
        const [activity, agenda] = await Promise.all([
          getCampaignActivity(agencyId, campaign.id),
          getPublishingSchedules(agencyId, campaign.id),
        ]);
        setActivityItems(activity.items);
        setPublishingAgenda(agenda);
        cacheCampaignActivity(queryClient, agencyId, campaign.id, activity);
        cachePublishingAgenda(queryClient, agencyId, campaign.id, agenda);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${label.toLowerCase()} campaign.`);
    } finally {
      setIsActivating(false);
    }
  };

  const refreshTeam = async () => {
    if (!agencyId || !campaign) return;
    const [team, activity] = await Promise.all([
      getCampaignTeam(agencyId, campaign.id),
      getCampaignActivity(agencyId, campaign.id),
    ]);
    setTeamAssignments(team);
    setActivityItems(activity.items);
    queryClient.setQueryData(queryKeys.campaignTeam(agencyId, campaign.id), team);
    cacheCampaignActivity(queryClient, agencyId, campaign.id, activity);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.campaignTeam(agencyId, campaign.id),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.campaignActivity(agencyId, campaign.id),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.campaignContent(agencyId, campaign.id),
    });
    invalidateWorkspaceQueries(queryClient, agencyId, [
      "dashboard",
      "workflow",
      "gigs",
      "calendar",
      "team",
    ]);
  };

  const refreshPublishing = async () => {
    if (!agencyId || !campaign) return;
    const [campaignData, agenda, activity] = await Promise.all([
      getCampaign(agencyId, campaign.id),
      getPublishingSchedules(agencyId, campaign.id),
      getCampaignActivity(agencyId, campaign.id),
    ]);
    hydrateCampaign(campaignData, reset, setDeliverables, setSchedules);
    setCampaign(campaignData);
    cacheCampaign(queryClient, agencyId, campaignData);
    setPublishingAgenda(agenda);
    setActivityItems(activity.items);
    cachePublishingAgenda(queryClient, agencyId, campaign.id, agenda);
    cacheCampaignActivity(queryClient, agencyId, campaign.id, activity);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.campaignContent(agencyId, campaign.id),
    });
    invalidateWorkspaceQueries(queryClient, agencyId, [
      "dashboard",
      "calendar",
      "workflow",
      "content",
      "gigs",
      "campaigns",
      "schedule",
    ]);
  };

  return (
    <div className="w-full px-2 lg:px-2 xl:px-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearRememberedEntityId(
                rememberedEntityKey("campaign", agencyId),
              );
              router.push(getWorkspaceHref(safeAgencySlug, "/campaigns"))
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            ←
          </button>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Campaign</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">
              {campaign?.name || (isLoading ? "Loading..." : "Campaign")}
            </h1>
          </div>
        </div>
        {campaign ? (
          <div className="flex items-center gap-2">
            {canEditCampaign && campaign.status === "DRAFT" ? (
              <button
                type="button"
                disabled={isActivating}
                onClick={activate}
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActivating ? "Activating..." : "Make active"}
              </button>
            ) : null}
            {canEditCampaign && campaign.status === "ACTIVE" ? (
              <>
                <button
                  type="button"
                  disabled={isActivating}
                  onClick={() => runStatusAction("Pause", () => pauseCampaign(agencyId!, campaign.id, campaign.version))}
                  className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Pause
                </button>
                <button
                  type="button"
                  disabled={isActivating}
                  onClick={() => runStatusAction("Complete", () => completeCampaign(agencyId!, campaign.id, campaign.version))}
                  className="rounded-full border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Complete
                </button>
              </>
            ) : null}
            {canEditCampaign && campaign.status === "PAUSED" ? (
              <button
                type="button"
                disabled={isActivating}
                onClick={() => runStatusAction("Resume", () => resumeCampaign(agencyId!, campaign.id, campaign.version))}
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resume
              </button>
            ) : null}
            {canEditCampaign && ["ACTIVE", "PAUSED", "COMPLETED"].includes(campaign.status) ? (
              <button
                type="button"
                disabled={isActivating}
                onClick={() => runStatusAction("Archive", () => archiveCampaign(agencyId!, campaign.id, campaign.version))}
                className="rounded-full border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Archive
              </button>
            ) : null}
            {canEditCampaign && campaign.status === "ARCHIVED" ? (
              <button
                type="button"
                disabled={isActivating}
                onClick={() => runStatusAction("Restore", () => restoreCampaign(agencyId!, campaign.id, campaign.version))}
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Restore
              </button>
            ) : null}
            {canEditCampaign ? (
              <button
                type="button"
                onClick={() => setIsEditing((value) => !value)}
                className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
              >
                {isEditing ? "Cancel edit" : "Edit"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <Panel>Loading campaign...</Panel>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : campaign ? (
        isEditing ? (
          <form className="space-y-2" onSubmit={handleSubmit(save)}>
            <CampaignPlanForm
              register={register}
              clients={clients}
              deliverables={deliverables}
              schedules={schedules}
              setDeliverables={setDeliverables}
              setSchedules={setSchedules}
            />
            <CampaignTeamSection
              teamAssignments={teamAssignments}
              structuredTeam={structuredTeam}
              canManageTeam={canManageCampaignTeam}
              onManage={() => setIsManagingTeam(true)}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!formState.isValid || isSaving}
                className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={statusPillClasses(campaign.status, "sm")}>{campaign.status}</span>
                    <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">{campaign.campaignCode || "Code pending"}</span>
                    {canViewOperationalFields ? (
                      <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">{campaign.priority || "No priority"}</span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm text-zinc-500">Client</p>
                  <h2 className="text-2xl font-semibold text-white">{campaign.client?.displayName || campaign.client?.name || "—"}</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-500">{metrics.dayLabel}</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{metrics.progress}%</p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-5">
              <Metric label="Content" value={metrics.totalContent} />
              <Metric label="Completed" value={metrics.completed} />
              <Metric label="Pending" value={metrics.pending} />
              <Metric label="Blocked" value={metrics.blocked} />
              <Metric label="Schedule" value={campaign.publishingSchedules?.length || 0} />
            </div>

            <div className="flex flex-wrap gap-2 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-2">
              {campaignTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${activeTab === tab ? "bg-indigo-500 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "overview" ? (
              <div className="grid gap-2 lg:grid-cols-2">
                <CampaignOverviewSections campaign={campaign} canViewOperationalFields={canViewOperationalFields} />
              </div>
            ) : null}

            {activeTab === "schedule" ? (
              <CampaignAgenda
                campaign={campaign}
                agenda={publishingAgenda}
                agencyId={agencyId!}
                agencySlug={agencySlug!}
                canManage={canManagePublishing(agency?.role, agency?.roles)}
                onChanged={refreshPublishing}
              />
            ) : null}

            {activeTab === "content" ? (
              <CampaignContentPlan
                campaign={campaign}
                agencyId={agencyId!}
                agencySlug={agencySlug!}
                agenda={publishingAgenda}
                campaignTeam={teamAssignments}
                canManage={canEditCampaign}
                onChanged={refreshPublishing}
              />
            ) : null}

            {activeTab === "team" ? (
              <CampaignTeamSection
                teamAssignments={teamAssignments}
                structuredTeam={structuredTeam}
                canManageTeam={canManageCampaignTeam}
                onManage={() => setIsManagingTeam(true)}
              />
            ) : null}

            {activeTab === "activity" ? (
              <CampaignActivitySection activityItems={activityItems} />
            ) : null}
          </div>
        )
      ) : null}

      {campaign && isManagingTeam ? (
        <CampaignTeamPanel
          campaignId={campaign.id}
          agencyId={agencyId!}
          members={members}
          assignments={teamAssignments}
          onClose={() => setIsManagingTeam(false)}
          onChanged={refreshTeam}
        />
      ) : null}
    </div>
  );
}

function hydrateCampaign(
  campaign: Campaign,
  reset: ReturnType<typeof useForm<CreateCampaignInput>>["reset"],
  setDeliverables: (items: CampaignDeliverablePlan[]) => void,
  setSchedules: (items: PublishingSchedule[]) => void,
) {
  reset({
    clientId: campaign.clientId,
    name: campaign.name || "",
    objective: campaign.objectives || campaign.brief || "",
    startDate: toDateInput(campaign.startDate),
    endDate: toDateInput(campaign.endDate),
    campaignType: campaign.campaignType || "",
    priority: campaign.priority || "",
    goal: campaign.goal || "",
    primaryKpi: campaign.primaryKpi || "",
    targetAudience: campaign.targetAudience || "",
    useClientAudience: campaign.useClientAudience,
    keyMessage: campaign.keyMessage || "",
    cta: campaign.cta || "",
    reviewFrequency: campaign.reviewFrequency || "",
    workingDays: campaign.workingDays || "",
    launchDate: toDateInput(campaign.launchDate),
    timezone: campaign.timezone || "Asia/Kolkata",
    workflowTemplate: campaign.workflowTemplate || "",
    clientApprover: campaign.clientApprover || "",
    agencyApproverMembershipId: campaign.agencyApproverMembershipId || "",
    approvalSla: campaign.approvalSla || "",
    revisionLimit: campaign.revisionLimit || "",
    references: campaign.references || "",
    moodBoardUrl: campaign.moodBoardUrl || "",
    driveFolderUrl: campaign.driveFolderUrl || "",
    internalNotes: campaign.internalNotes || "",
    autoGenerateCalendar: campaign.autoGenerateCalendar,
    postingDays: campaign.postingDays || "",
    postingWindows: campaign.postingWindows || "",
    blackoutDates: campaign.blackoutDates || "",
    platformMix: campaign.platformMix || "",
  });
  setDeliverables(campaign.deliverablePlans?.length ? campaign.deliverablePlans : []);
  setSchedules(
    campaign.publishingSchedules?.map((slot) => ({
      ...slot,
      scheduledAt: toDateTimeInput(slot.scheduledAt),
    })) || [],
  );
}

function buildPayload(
  data: CreateCampaignInput,
  deliverables: CampaignDeliverablePlan[],
  schedules: PublishingSchedule[],
): CreateCampaignInput {
  return {
    ...data,
    deliverablePlans: deliverables
      .filter((plan) => plan.contentType && Number(plan.quantity) > 0)
      .map((plan) => ({ ...plan, quantity: Number(plan.quantity) })),
    publishingSchedules: schedules
      .filter((schedule) => schedule.platform && schedule.scheduledAt)
      .map((schedule) => ({
        ...schedule,
        scheduledAt: new Date(schedule.scheduledAt).toISOString(),
        timezone: schedule.timezone || data.timezone || "Asia/Kolkata",
      })),
  };
}

function CampaignOverviewSections({ campaign, canViewOperationalFields }: { campaign: Campaign; canViewOperationalFields: boolean }) {
  return (
    <>
      <Section title="Overview">
        <Detail label="Campaign Type" value={campaign.campaignType} />
        <Detail label="Goal" value={campaign.goal || campaign.objectives || campaign.brief} />
        <Detail label="Primary KPI" value={campaign.primaryKpi} />
        <Detail label="CTA" value={campaign.cta} />
      </Section>

      <Section title="Timeline">
        <Detail label="Start Date" value={formatDate(campaign.startDate)} />
        <Detail label="End Date" value={formatDate(campaign.endDate)} />
        <Detail label="Launch Date" value={formatDate(campaign.launchDate)} />
        <Detail label="Review Frequency" value={campaign.reviewFrequency} />
        <Detail label="Timezone" value={campaign.timezone} />
      </Section>

      <Section title="Strategy">
        <Detail label="Campaign Brief" value={campaign.objectives || campaign.brief} wide />
        <Detail label="Target Audience" value={campaign.useClientAudience ? "Use client audience" : campaign.targetAudience} wide />
        <Detail label="Key Message" value={campaign.keyMessage} wide />
      </Section>

      <Section title="Deliverables">
        {campaign.deliverablePlans?.length ? (
          <div className="space-y-2">
            {campaign.deliverablePlans.map((plan) => (
              <div key={plan.id || `${plan.contentType}-${plan.platform}`} className="rounded-2xl border border-zinc-800 p-4 text-sm">
                <div className="font-semibold text-white">{plan.quantity} {labelize(plan.contentType)}</div>
                <div className="mt-1 text-zinc-500">{plan.frequency || "No frequency"} · {labelize(plan.platform || "No platform")} · {plan.preferredDays || "Any day"} {plan.preferredTime || ""}</div>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Workflow">
        <Detail label="Template" value={campaign.workflowTemplate} />
        {canViewOperationalFields ? (
          <>
            <Detail label="Agency Approver" value={campaign.agencyApprover?.user?.name || campaign.agencyApproverMembershipId} />
            <Detail label="Client Approver" value={campaign.clientApprover} />
            <Detail label="Approval SLA" value={campaign.approvalSla} />
            <Detail label="Revision Limit" value={campaign.revisionLimit} />
          </>
        ) : (
          <Detail label="Production Context" value="Workflow details are available when content work starts." />
        )}
      </Section>

      <Section title={canViewOperationalFields ? "References & Internal" : "References"}>
        <Detail label="Mood Board" value={campaign.moodBoardUrl} wide />
        <Detail label="Drive Folder" value={campaign.driveFolderUrl} wide />
        <Detail label="References" value={campaign.references} wide />
        {canViewOperationalFields ? <Detail label="Internal Notes" value={campaign.internalNotes} wide /> : null}
      </Section>
    </>
  );
}

function CampaignAgenda({
  campaign,
  agenda,
  agencyId,
  agencySlug,
  canManage,
  onChanged,
}: {
  campaign: Campaign;
  agenda: PublishingScheduleAgendaResponse | null;
  agencyId: string;
  agencySlug: string;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [platform, setPlatform] = useState("INSTAGRAM");
  const [scheduledAt, setScheduledAt] = useState("");
  const [contentAssetId, setContentAssetId] = useState("");
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSlot = async () => {
    if (!scheduledAt) return;
    setIsSaving(true);
    setError(null);
    try {
      await createPublishingSchedule(agencyId, campaign.id, {
        platform,
        scheduledAt: new Date(scheduledAt).toISOString(),
        timezone: campaign.timezone || "Asia/Kolkata",
        contentAssetId: contentAssetId || null,
        caption: caption || null,
        note: note || null,
      });
      setScheduledAt("");
      setContentAssetId("");
      setCaption("");
      setNote("");
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create publishing slot.");
    } finally {
      setIsSaving(false);
    }
  };

  const reschedule = async (slot: PublishingSchedule) => {
    const next = await dialog.prompt({
      title: "Reschedule Publishing Slot",
      description: "Select new publishing date and time",
      defaultValue: toDateTimeInput(slot.scheduledAt),
      inputType: "datetime-local",
      confirmText: "Reschedule",
    });
    if (!next || !slot.id || !slot.version) return;
    setIsSaving(true);
    setError(null);
    try {
      await updatePublishingSchedule(agencyId, campaign.id, slot.id, {
        scheduledAt: new Date(next).toISOString(),
        version: slot.version,
      });
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reschedule publishing slot.");
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = async (slot: PublishingSchedule) => {
    const reason = await dialog.prompt({
      title: "Cancel Publishing Slot",
      description: "Enter a reason for cancelling this slot",
      placeholder: "e.g. Schedule adjustment",
      confirmText: "Cancel Slot",
      variant: "danger",
    });
    if (!reason || !slot.id || !slot.version) return;
    setIsSaving(true);
    setError(null);
    try {
      await cancelPublishingSchedule(agencyId, campaign.id, slot.id, { version: slot.version, cancellationReason: reason });
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel publishing slot.");
    } finally {
      setIsSaving(false);
    }
  };

  const markPublished = async (slot: PublishingSchedule) => {
    const publishedUrl = await dialog.prompt({
      title: "Mark as Published",
      description: "Enter the live URL for this published content",
      placeholder: "https://instagram.com/p/...",
      inputType: "url",
      confirmText: "Mark Published",
    });
    if (!publishedUrl || !slot.id || !slot.version) return;
    setIsSaving(true);
    setError(null);
    try {
      await markPublishingSchedulePublished(agencyId, campaign.id, slot.id, { version: slot.version, publishedUrl });
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark publishing slot as published.");
    } finally {
      setIsSaving(false);
    }
  };

  const generateProduction = async (slot: PublishingSchedule) => {
    if (!slot.id) return;
    const fallbackTitle = `${labelize(inferContentType(slot))} ${new Date(slot.scheduledAt).toLocaleDateString()}`;
    const title = await dialog.prompt({
      title: "Create Content Asset",
      description: "Enter title for the production content item",
      defaultValue: fallbackTitle,
      placeholder: "e.g. Behind the scenes reel",
      confirmText: "Create Content",
    });
    if (!title) return;
    setIsSaving(true);
    setError(null);
    try {
      await generatePublishingProduction(agencyId, campaign.id, slot.id, {
        contentType: inferContentType(slot),
        title,
        brief: slot.note || slot.caption || null,
      });
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate production work.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20">
        <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Schedule</h2>
        <p className="mt-3 text-xl font-semibold text-white">Campaign-specific timing.</p>
        <p className="mt-1 text-sm text-zinc-500">
          Publishing slots stay linked to content assets where possible. Shoot and production due dates come from workflow tasks when they exist.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Upcoming" value={agenda?.summary.upcoming || 0} />
        <Metric label="Ready" value={agenda?.summary.ready || 0} />
        <Metric label="At Risk" value={agenda?.summary.atRisk || 0} />
        <Metric label="Missed" value={agenda?.summary.missed || 0} />
      </div>

      {canManage ? (
        <Section title="Add Publishing Slot">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
              {publishingPlatformOptions.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
            </select>
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="date-input rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
            <select value={contentAssetId} onChange={(event) => setContentAssetId(event.target.value)} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
              <option value="">No content linked</option>
              {campaign.contentAssets?.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.displayCode || "CONTENT"} · {asset.title || "Untitled"}</option>
              ))}
            </select>
            <button type="button" onClick={createSlot} disabled={!scheduledAt || isSaving} className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
              Add Slot
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption/reference note" className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note" className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>
          {error ? <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</div> : null}
        </Section>
      ) : null}

      <Section title="Publishing Agenda">
        {agenda?.items.length ? (
          <div className="space-y-3">
            {agenda.items.map((slot) => (
              <div key={slot.id} className="rounded-2xl border border-zinc-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{labelize(slot.platform)}</span>
                      <span className={statusPillClasses(slot.status || "PLANNED")}>{slot.status || "PLANNED"}</span>
                      <span className={statusPillClasses(slot.riskStatus || "ON_TRACK")}>{slot.riskStatus || "ON_TRACK"}</span>
                    </div>
                    <div className="mt-2 text-sm text-zinc-400">{formatDateTime(slot.scheduledAt)} · {slot.timezone || campaign.timezone || "Asia/Kolkata"}</div>
                    {slot.contentAsset ? (
                      <button
                        type="button"
                        onClick={() => router.push(getWorkspaceHref(agencySlug, `/workflow/${slot.contentAsset!.id}`))}
                        className="mt-2 text-left text-sm font-semibold text-indigo-400 transition hover:text-indigo-300"
                      >
                        {slot.contentAsset.displayCode} · {slot.contentAsset.title}
                      </button>
                    ) : (
                      <div className="mt-2 text-sm text-zinc-200">No content linked</div>
                    )}
                    <div className="mt-1 text-xs text-zinc-500">{slot.readiness || "UNLINKED"} · {slot.readinessReason || "No readiness reason"}</div>
                    {slot.workflow?.owner ? <div className="mt-1 text-xs text-zinc-500">Owner: {slot.workflow.owner.name}</div> : null}
                  </div>
                  {canManage && !["PUBLISHED", "CANCELLED", "MISSED"].includes(slot.status || "") ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={isSaving} onClick={() => reschedule(slot)} className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900">Reschedule</button>
                      {!slot.contentAsset ? (
                        <button type="button" disabled={isSaving} onClick={() => generateProduction(slot)} className="rounded-full border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/10">Generate Production</button>
                      ) : null}
                      <button type="button" disabled={isSaving} onClick={() => cancel(slot)} className="rounded-full border border-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10">Cancel</button>
                      <button type="button" disabled={isSaving} onClick={() => markPublished(slot)} className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10">Mark Published</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No publishing slots planned yet." />
        )}
      </Section>
    </div>
  );
}

function CampaignTeamSection({
  teamAssignments,
  structuredTeam,
  canManageTeam,
  onManage,
}: {
  teamAssignments: CampaignTeamAssignment[];
  structuredTeam: Record<CampaignAssignmentRole, CampaignTeamAssignment[]>;
  canManageTeam: boolean;
  onManage: () => void;
}) {
  return (
    <Section title="Team">
      {teamAssignments.length ? (
        <div className="space-y-4">
          {assignmentRoleOrder.map((role) => structuredTeam[role]?.length ? (
            <div key={role} className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-zinc-500">{assignmentRoleLabel(role)}</div>
              <div className="flex flex-wrap gap-2">
                {structuredTeam[role].map((assignment) => (
                  <span key={assignment.id} className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-200">
                    {assignmentMemberName(assignment)}
                  </span>
                ))}
              </div>
            </div>
          ) : null)}
        </div>
      ) : (
        <Empty text="Team will be attached as content work starts." />
      )}
      {canManageTeam ? (
        <button
          type="button"
          onClick={onManage}
          className="mt-4 rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
        >
          Manage Team
        </button>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">Team assignments are read-only for your current role.</p>
      )}
    </Section>
  );
}

function CampaignActivitySection({ activityItems }: { activityItems: CampaignActivityItem[] }) {
  return (
    <Section title="Activity">
      {activityItems.length ? (
        <div className="space-y-4">
          {activityItems.slice(0, 30).map((item) => (
            <div key={item.id} className="grid gap-2 border-l border-zinc-800 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-200">{item.message}</span>
                <span className="text-xs text-zinc-600">{formatDateTime(item.occurredAt)}</span>
              </div>
              <div className="text-xs text-zinc-500">
                {item.actor?.name ? `By ${item.actor.name}` : "System event"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Activity will appear as this campaign moves." />
      )}
    </Section>
  );
}

function CampaignTeamPanel({
  agencyId,
  campaignId,
  members,
  assignments,
  onClose,
  onChanged,
}: {
  agencyId: string;
  campaignId: string;
  members: Member[];
  assignments: CampaignTeamAssignment[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const dialog = useDialog();
  const [membershipId, setMembershipId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<CampaignAssignmentRole>("WRITER");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assign = async () => {
    if (!membershipId) return;
    setIsSaving(true);
    setError(null);
    try {
      await assignCampaignTeamMember(agencyId, campaignId, { membershipId, assignmentRole });
      setMembershipId("");
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign team member.");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (assignment: CampaignTeamAssignment) => {
    const memberName = assignmentMemberName(assignment);
    const roleName = assignmentRoleLabel(assignment.assignmentRole);
    const confirmed = await dialog.confirm({
      title: "Remove Team Member",
      description: `Are you sure you want to remove ${memberName} from the ${roleName} role for this campaign?`,
      confirmText: "Remove Member",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    setIsSaving(true);
    setError(null);
    try {
      await removeCampaignTeamAssignment(agencyId, campaignId, assignment.id);
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove team member.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 sm:items-center">
      <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Campaign Team</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Manage responsibilities</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select value={assignmentRole} onChange={(event) => setAssignmentRole(event.target.value as CampaignAssignmentRole)} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
            {assignmentRoleOrder.map((role) => (
              <option key={role} value={role}>{assignmentRoleLabel(role)}</option>
            ))}
          </select>
          <select value={membershipId} onChange={(event) => setMembershipId(event.target.value)} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
            <option value="">Select member...</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name || member.email || member.mobileNumber || "Unnamed member"}</option>
            ))}
          </select>
          <button type="button" onClick={assign} disabled={!membershipId || isSaving} className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
            Assign
          </button>
        </div>

        {error ? <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</div> : null}

        <div className="mt-6 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {assignmentRoleOrder.map((role) => {
            const items = assignments.filter((assignment) => assignment.assignmentRole === role);
            if (!items.length) return null;
            return (
              <div key={role} className="rounded-2xl border border-zinc-800 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{assignmentRoleLabel(role)}</div>
                <div className="mt-3 space-y-2">
                  {items.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#0b0b11] px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-zinc-200">{assignmentMemberName(assignment)}</div>
                        <div className="text-xs text-zinc-500">{assignmentMemberRoles(assignment)}</div>
                      </div>
                      <button type="button" disabled={isSaving} onClick={() => remove(assignment)} className="rounded-full border border-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!assignments.length ? <Empty text="No campaign team assigned yet." /> : null}
        </div>
      </div>
    </div>
  );
}

function getCampaignMetrics(campaign: Campaign | null) {
  const assets = campaign?.contentAssets || [];
  const completed = assets.filter((asset) => ["PUBLISHED", "APPROVED", "COMPLETED"].includes(asset.status)).length;
  const blocked = assets.filter((asset) => asset.riskStatus === "BLOCKED").length;
  const pending = Math.max(assets.length - completed, 0);
  const progress = assets.length ? Math.round((completed / assets.length) * 100) : 0;

  return {
    totalContent: assets.length,
    completed,
    pending,
    blocked,
    progress,
    dayLabel: campaign ? getDayLabel(campaign.startDate, campaign.endDate) : "—",
  };
}

function getDayLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return "Timeline not set";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const today = new Date();
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const currentDay = Math.min(totalDays, Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / 86400000) + 1));
  return `Day ${currentDay} of ${totalDays}`;
}

function Panel({ children }: { children: string }) {
  return <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-500">{children}</div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20"><p className="text-sm text-zinc-500">{label}</p><p className="mt-4 text-3xl font-semibold text-white">{value}</p></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20"><h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">{title}</h2><div className="mt-5 space-y-3">{children}</div></section>;
}

function Detail({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  return <div className={wide ? "" : "grid grid-cols-[140px_1fr] gap-3"}><div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div><div className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value || "—"}</div></div>;
}

function Empty({ text = "— Not provided" }: { text?: string }) {
  return <p className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">{text}</p>;
}

function groupAssignments(assignments: CampaignTeamAssignment[]) {
  return assignments.reduce((acc, assignment) => {
    if (!acc[assignment.assignmentRole]) acc[assignment.assignmentRole] = [];
    acc[assignment.assignmentRole].push(assignment);
    return acc;
  }, {} as Record<CampaignAssignmentRole, CampaignTeamAssignment[]>);
}

function assignmentRoleLabel(role: CampaignAssignmentRole) {
  const labels: Record<CampaignAssignmentRole, string> = {
    CAMPAIGN_MANAGER: "Campaign Manager",
    RELATIONSHIP_MANAGER: "Relationship Manager",
    WRITER: "Writers",
    EDITOR: "Editors",
    DESIGNER: "Designers",
    DOP: "DOP",
    SOCIAL_MEDIA_MANAGER: "Social Media Manager",
    CLIENT_APPROVER: "Client Approver",
    AGENCY_APPROVER: "Agency Approver",
  };
  return labels[role];
}

function assignmentMemberName(assignment: CampaignTeamAssignment) {
  return assignment.membership.name || assignment.membership.user?.name || assignment.membership.user?.email || "Unnamed member";
}

function assignmentMemberRoles(assignment: CampaignTeamAssignment) {
  const roles = assignment.membership.roles?.map((item) => item.role?.displayName || item.role?.systemRole?.displayName).filter(Boolean);
  return roles?.length ? roles.join(", ") : assignment.membership.role?.displayName || "Member";
}

function canViewFullCampaign(role?: string, roles?: Array<{ key: string; name: string }>) {
  const normalizedRoles = [
    role,
    ...(roles?.flatMap((item) => [item.key, item.name]) || []),
  ]
    .filter(Boolean)
    .map((item) => item!.toUpperCase());

  return normalizedRoles.some((item) => ["OWNER", "ADMIN", "MANAGER"].includes(item));
}

function canManageTeam(role?: string, roles?: Array<{ key: string; name: string }>, membershipId?: string, assignments: CampaignTeamAssignment[] = []) {
  if (canViewFullCampaign(role, roles)) return true;
  if (!membershipId) return false;

  return assignments.some((assignment) =>
    assignment.membershipId === membershipId &&
    ["CAMPAIGN_MANAGER", "RELATIONSHIP_MANAGER"].includes(assignment.assignmentRole)
  );
}

function canManagePublishing(role?: string, roles?: Array<{ key: string; name: string }>) {
  const normalizedRoles = [
    role,
    ...(roles?.flatMap((item) => [item.key, item.name]) || []),
  ]
    .filter(Boolean)
    .map((item) => item!.toUpperCase());

  return normalizedRoles.some((item) => ["OWNER", "ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(item));
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

function labelize(value?: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "—";
}

function inferContentType(slot: PublishingSchedule) {
  const text = `${slot.caption || ""} ${slot.note || ""} ${slot.platform || ""}`.toUpperCase();
  if (text.includes("CAROUSEL")) return "CAROUSEL";
  if (text.includes("STORY")) return "STORY";
  if (text.includes("BLOG")) return "BLOG";
  if (text.includes("YOUTUBE")) return "YOUTUBE";
  if (text.includes("AD")) return "AD";
  if (text.includes("STATIC") || text.includes("POST")) return "STATIC";
  return "REEL";
}

function cacheCampaign(queryClient: ReturnType<typeof useQueryClient>, agencyId: string, campaign: Campaign) {
  queryClient.setQueryData(queryKeys.campaign(agencyId, campaign.id), campaign);
  queryClient.setQueryData(queryKeys.campaigns(agencyId), (current: Campaign[] | undefined) => setListItem(current, campaign));
  invalidateWorkspaceQueries(queryClient, agencyId, [
    "campaigns",
    "dashboard",
    "schedule",
    "calendar",
    "workflow",
    "content",
    "gigs",
  ]);
}

function cacheCampaignActivity(
  queryClient: ReturnType<typeof useQueryClient>,
  agencyId: string,
  campaignId: string,
  activity: CampaignActivityResponse,
) {
  queryClient.setQueryData(
    queryKeys.campaignActivity(agencyId, campaignId),
    activity,
  );
}

function cachePublishingAgenda(
  queryClient: ReturnType<typeof useQueryClient>,
  agencyId: string,
  campaignId: string,
  agenda: PublishingScheduleAgendaResponse,
) {
  queryClient.setQueryData(
    queryKeys.publishingSchedules(agencyId, campaignId),
    agenda,
  );
}
