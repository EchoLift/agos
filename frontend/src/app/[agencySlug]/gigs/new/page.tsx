"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAgency } from "@/components/AgencyProvider";
import { Member } from "@/lib/api/team";
import { createWorkOrder, WorkOrder, WorkOrderPriority, WorkOrderType } from "@/lib/api/work-orders";
import { formatLabel } from "@/lib/status-style";
import { invalidateWorkspaceQueries, queryKeys, setListItem, useClientsQuery, useTeamQuery } from "@/lib/query";
import { getWorkspaceHref } from "@/lib/workspace-url";

const workTypes: WorkOrderType[] = ["SCRIPT", "EDIT", "DESIGN", "SHOOT", "THUMBNAIL", "CAPTION", "RESEARCH", "OTHER"];
const priorities: WorkOrderPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function NewGigPage() {
  const router = useRouter();
  const safeAgencySlug = useAgency().agencySlug ?? "";
  const queryClient = useQueryClient();
  const { agencyId } = useAgency();
  const clientsQuery = useClientsQuery(agencyId);
  const teamQuery = useTeamQuery(agencyId);
  const clients = clientsQuery.data ?? [];
  const members = useMemo(() => (teamQuery.data ?? []).filter((member) => member.status === "ACTIVE"), [teamQuery.data]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    title: "",
    description: "",
    workType: "SCRIPT" as WorkOrderType,
    priority: "MEDIUM" as WorkOrderPriority,
    assigneeMembershipId: "",
    reviewerMembershipId: "",
    dueAt: "",
    estimatedHours: "",
    rewardAmount: "",
    rewardCurrency: "INR",
  });

  const assigneeOptions = useMemo(
    () => members.filter((member) => roleMatchesType(member, form.workType)),
    [form.workType, members],
  );

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!agencyId) return;
    setError("");
    setSaving(true);
    try {
      const estimatedHours = form.estimatedHours.trim() ? Number(form.estimatedHours) : undefined;
      const rewardAmount = form.rewardAmount.trim() ? Number(form.rewardAmount) : undefined;
      const gig = await createWorkOrder(agencyId, {
        ...(form.clientId ? { clientId: form.clientId } : {}),
        title: form.title.trim(),
        description: form.description.trim(),
        workType: form.workType,
        priority: form.priority,
        assigneeMembershipId: form.assigneeMembershipId,
        ...(form.reviewerMembershipId ? { reviewerMembershipId: form.reviewerMembershipId } : {}),
        dueAt: new Date(form.dueAt).toISOString(),
        ...(estimatedHours ? { estimatedHours } : {}),
        ...(rewardAmount ? { rewardAmount, rewardCurrency: form.rewardCurrency || "INR" } : {}),
      });
      queryClient.setQueryData(queryKeys.gig(agencyId, gig.id), gig);
      queryClient.setQueryData(queryKeys.gigs(agencyId), (current: WorkOrder[] | undefined) => setListItem(current, gig));
      invalidateWorkspaceQueries(queryClient, agencyId, [
        "gigs",
        "dashboard",
        "calendar",
        "workflow",
      ]);
      router.push(getWorkspaceHref(safeAgencySlug, `/gigs/${gig.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create gig");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">New gig</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Assign Work</h1>
        </div>
        <button type="button" onClick={() => router.back()} className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Cancel
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
        {error ? <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-400">
            Client
            <select value={form.clientId} onChange={(event) => update("clientId", event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500">
              <option value="">No client / internal</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.displayName ?? client.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-zinc-400">
            Gig type
            <select value={form.workType} onChange={(event) => update("workType", event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500">
              {workTypes.map((type) => <option key={type} value={type}>{formatLabel(type)}</option>)}
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm text-zinc-400">
          Title
          <input value={form.title} onChange={(event) => update("title", event.target.value)} required placeholder="Need 5 Telugu scripts by Friday" className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500" />
        </label>

        <label className="space-y-2 text-sm text-zinc-400">
          Instructions
          <textarea value={form.description} onChange={(event) => update("description", event.target.value)} required placeholder="What should be done, style, references, output format..." rows={5} className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-400">
            Assignee
            <select value={form.assigneeMembershipId} onChange={(event) => update("assigneeMembershipId", event.target.value)} required className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500">
              <option value="">Select assignee</option>
              {assigneeOptions.map((member) => (
                <option key={member.id} value={member.id}>{member.name ?? "Unnamed"} · {member.roles?.map((role) => role.name).join(", ") || member.roleName}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-zinc-400">
            Reviewer
            <select value={form.reviewerMembershipId} onChange={(event) => update("reviewerMembershipId", event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500">
              <option value="">Owner / manager can review</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name ?? "Unnamed"}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-2 text-sm text-zinc-400 md:col-span-2">
            Due
            <input type="datetime-local" value={form.dueAt} onChange={(event) => update("dueAt", event.target.value)} required className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500" />
          </label>
          <label className="space-y-2 text-sm text-zinc-400">
            Priority
            <select value={form.priority} onChange={(event) => update("priority", event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500">
              {priorities.map((priority) => <option key={priority} value={priority}>{formatLabel(priority)}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-zinc-400">
            Hours <span className="text-zinc-500">(optional)</span>
            <input type="number" min="1" value={form.estimatedHours} onChange={(event) => update("estimatedHours", event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-white outline-none focus:border-indigo-500" />
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60">
            {saving ? "Creating..." : "Create Gig"}
          </button>
        </div>
      </form>
    </div>
  );
}

function roleMatchesType(member: Member, workType: WorkOrderType) {
  const roles = new Set([member.roleName, ...(member.roles?.flatMap((role) => [role.key, role.name]) ?? [])].map((role) => role.toUpperCase().replace(/[\s-]+/g, "_")));
  const typeRoles: Record<WorkOrderType, string[]> = {
    SCRIPT: ["WRITER"],
    EDIT: ["EDITOR"],
    DESIGN: ["DESIGNER"],
    SHOOT: ["DOP"],
    THUMBNAIL: ["DESIGNER"],
    CAPTION: ["WRITER", "SOCIAL_MEDIA_MANAGER"],
    RESEARCH: ["WRITER", "MEMBER"],
    OTHER: [],
  };
  const allowed = typeRoles[workType];
  return !allowed.length || allowed.some((role) => roles.has(role));
}
