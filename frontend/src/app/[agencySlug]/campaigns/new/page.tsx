"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CampaignPlanForm } from "@/components/CampaignPlanForm";
import { useAgency } from "@/components/AgencyProvider";
import {
  assignCampaignTeamMember,
  Campaign,
  CampaignAssignmentRole,
  CampaignDeliverablePlan,
  createCampaign,
  CreateCampaignInput,
  PublishingSchedule,
} from "@/lib/api/campaigns";
import { Member } from "@/lib/api/team";
import { invalidateWorkspaceQueries, queryKeys, setListItem, useClientsQuery, useTeamQuery } from "@/lib/query";
import { getWorkspaceHref } from "@/lib/workspace-url";

const defaultDeliverable: CampaignDeliverablePlan = {
  contentType: "REEL",
  quantity: 4,
  frequency: "Weekly",
  platform: "INSTAGRAM",
};

const assignmentRoles: CampaignAssignmentRole[] = [
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

type TeamDraft = {
  membershipId: string;
  assignmentRole: CampaignAssignmentRole;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { agencyId } = useAgency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientsQuery = useClientsQuery(agencyId);
  const teamQuery = useTeamQuery(agencyId);
  const clients = clientsQuery.data ?? [];
  const members = teamQuery.data ?? [];
  const [deliverables, setDeliverables] = useState<CampaignDeliverablePlan[]>([defaultDeliverable]);
  const [schedules, setSchedules] = useState<PublishingSchedule[]>([]);
  const [teamDrafts, setTeamDrafts] = useState<TeamDraft[]>([]);
  const safeAgencySlug = useAgency().agencySlug ?? "";
  const { register, handleSubmit, formState } = useForm<CreateCampaignInput>({
    mode: "onChange",
    defaultValues: {
      clientId: "",
      name: "",
      objective: "",
      startDate: "",
      endDate: "",
      campaignType: "Branding",
      priority: "Medium",
      goal: "Brand Awareness",
      primaryKpi: "Reach",
      cta: "DM",
      reviewFrequency: "Weekly",
      timezone: "Asia/Kolkata",
      workflowTemplate: "Standard Reel",
      approvalSla: "24 Hours",
      revisionLimit: "3",
      useClientAudience: true,
      autoGenerateCalendar: true,
    },
  });

  const onSubmit = async (data: CreateCampaignInput) => {
    if (!agencyId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const campaign = await createCampaign(agencyId, buildPayload(data, deliverables, schedules));
      for (const draft of teamDrafts) {
        await assignCampaignTeamMember(agencyId, campaign.id, draft);
      }
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
      router.push(getWorkspaceHref(safeAgencySlug, `/campaigns/${campaign.id}`));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create campaign.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          type="button"
        >
          ←
        </button>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">New Campaign</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Add Campaign</h1>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <CampaignPlanForm
          register={register}
          clients={clients}
          deliverables={deliverables}
          schedules={schedules}
          setDeliverables={setDeliverables}
          setSchedules={setSchedules}
        />

        <CampaignTeamDraftSection
          members={members}
          teamDrafts={teamDrafts}
          setTeamDrafts={setTeamDrafts}
        />

        {error ? (
          <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={getWorkspaceHref(safeAgencySlug, "/campaigns")}
            className="rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!formState.isValid || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Save Campaign"}
          </button>
        </div>
      </form>
    </div>
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

function CampaignTeamDraftSection({
  members,
  teamDrafts,
  setTeamDrafts,
}: {
  members: Member[];
  teamDrafts: TeamDraft[];
  setTeamDrafts: (items: TeamDraft[]) => void;
}) {
  const [membershipId, setMembershipId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<CampaignAssignmentRole>("CAMPAIGN_MANAGER");

  const addAssignment = () => {
    if (!membershipId) return;
    const alreadyAssigned = teamDrafts.some((item) => item.membershipId === membershipId && item.assignmentRole === assignmentRole);
    if (alreadyAssigned) return;

    const singleRoleExists =
      ["CAMPAIGN_MANAGER", "RELATIONSHIP_MANAGER"].includes(assignmentRole) &&
      teamDrafts.some((item) => item.assignmentRole === assignmentRole);
    if (singleRoleExists) {
      setTeamDrafts(teamDrafts.map((item) => item.assignmentRole === assignmentRole ? { membershipId, assignmentRole } : item));
    } else {
      setTeamDrafts([...teamDrafts, { membershipId, assignmentRole }]);
    }

    setMembershipId("");
  };

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Campaign Team</h2>
          <p className="mt-2 text-sm text-zinc-500">Assign campaign responsibilities now, or manage them later from the campaign Team tab.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <select
          value={assignmentRole}
          onChange={(event) => setAssignmentRole(event.target.value as CampaignAssignmentRole)}
          className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
        >
          {assignmentRoles.map((role) => (
            <option key={role} value={role}>{assignmentRoleLabel(role)}</option>
          ))}
        </select>

        <select
          value={membershipId}
          onChange={(event) => setMembershipId(event.target.value)}
          className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="">Select member...</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name || member.email || member.mobileNumber || "Unnamed member"} · {memberRoleLabel(member)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={addAssignment}
          disabled={!membershipId}
          className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {teamDrafts.length ? (
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {teamDrafts.map((draft) => {
            const member = members.find((item) => item.id === draft.membershipId);
            return (
              <div key={`${draft.assignmentRole}-${draft.membershipId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-200">{member?.name || member?.email || member?.mobileNumber || "Team member"}</div>
                  <div className="text-xs text-zinc-500">{assignmentRoleLabel(draft.assignmentRole)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamDrafts(teamDrafts.filter((item) => item !== draft))}
                  className="rounded-full border border-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No team assigned yet.</p>
      )}
    </section>
  );
}

function assignmentRoleLabel(role: CampaignAssignmentRole) {
  const labels: Record<CampaignAssignmentRole, string> = {
    CAMPAIGN_MANAGER: "Campaign Manager",
    RELATIONSHIP_MANAGER: "Relationship Manager",
    WRITER: "Writer",
    EDITOR: "Editor",
    DESIGNER: "Designer",
    DOP: "DOP",
    SOCIAL_MEDIA_MANAGER: "Social Media Manager",
    CLIENT_APPROVER: "Client Approver",
    AGENCY_APPROVER: "Agency Approver",
  };

  return labels[role];
}

function memberRoleLabel(member: Member) {
  return member.roles?.length ? member.roles.map((role) => role.name).join(", ") : member.roleName || "Member";
}
