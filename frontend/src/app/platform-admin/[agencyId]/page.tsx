"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPlatformAgency,
  type SubscriptionRecord,
  updateAgencyEntitlement,
} from "@/lib/api/platform-admin";
import {
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
} from "@/lib/api/organization";
import {
  entitlementActionPayload,
  entitlementActions,
  entitlementEditorValues,
  entitlementPatchPayload,
  invalidatePlatformEntitlementQueries,
  runConfirmedEntitlementAction,
  validateEntitlementEditor,
  validateReactivation,
} from "@/lib/platform-entitlement-editor";
import { useDialog } from "@/components/ui/DialogProvider";

export default function PlatformAgencyPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = use(params);
  const query = useQuery({ queryKey: ["platform-admin", "agency", agencyId], queryFn: () => getPlatformAgency(agencyId) });

  if (query.error) return <Shell><p className="text-red-300">{query.error instanceof Error ? query.error.message : "Unable to load agency."}</p></Shell>;
  if (!query.data) return <Shell><p className="text-zinc-400">Loading agency…</p></Shell>;
  const { agency, metrics, members, recentActivity } = query.data;
  return <Shell>
    <Link href="/platform-admin" className="text-sm text-indigo-300">← Platform overview</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">{agency.displayName || agency.name}</h1><p className="mt-1 text-zinc-500">{agency.slug} · created {new Date(agency.createdAt).toLocaleDateString()}</p></div><p className="rounded-full border border-zinc-700 px-3 py-1 text-sm">{agency.subscription?.status ?? "No entitlement"}</p></div>
    <div className="mt-8 grid gap-3 sm:grid-cols-4">{Object.entries(metrics).map(([key, value]) => <div key={key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs capitalize text-zinc-500">{key.replace(/([A-Z])/g, " $1")}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <EntitlementEditor key={agency.subscription?.updatedAt ?? "new"} agencyId={agencyId} agencyName={agency.displayName || agency.name} subscription={agency.subscription} />
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><h2 className="font-semibold">Members</h2><div className="mt-4 space-y-3">{members.map((member) => <div key={member.id} className="flex justify-between border-t border-zinc-900 pt-3 text-sm"><span>{member.user.name || "Unnamed user"}</span><span className="text-zinc-500">{member.role.systemRole.key}</span></div>)}</div></section><section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><h2 className="font-semibold">Meaningful activity</h2><div className="mt-4 space-y-3">{recentActivity.length ? recentActivity.map((event) => <div key={event.id} className="border-t border-zinc-900 pt-3 text-sm"><p>{event.eventType}</p><p className="text-xs text-zinc-600">{new Date(event.createdAt).toLocaleString()}</p></div>) : <p className="text-sm text-zinc-500">Unavailable from current audit records.</p>}</div></section></div>
  </Shell>;
}

function EntitlementEditor({ agencyId, agencyName, subscription }: { agencyId: string; agencyName: string; subscription: SubscriptionRecord | null }) {
  const initial = entitlementEditorValues(subscription);
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const [status, setStatus] = useState<SubscriptionStatus>(initial.status);
  const [plan, setPlan] = useState(initial.plan);
  const [trialEndsAt, setTrialEndsAt] = useState(initial.trialEndsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivationStatus, setReactivationStatus] = useState<SubscriptionStatus>("ACTIVE");
  const [reactivationTrialEnd, setReactivationTrialEnd] = useState(initial.trialEndsAt);
  const [reactivationEnd, setReactivationEnd] = useState(initial.endsAt);
  const mutation = useMutation({
    mutationFn: updateAgencyEntitlement.bind(null, agencyId),
    onSuccess: async () => {
      await invalidatePlatformEntitlementQueries(agencyId, (queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
    },
  });

  function saveEntitlement() {
    const values = { status, plan, trialEndsAt, startsAt: initial.startsAt, endsAt };
    const error = validateEntitlementEditor(values);
    setValidationError(error);
    if (!error) mutation.mutate(entitlementPatchPayload(values));
  }

  async function confirmAction(action: "SUSPEND" | "CANCEL") {
    if (!subscription) return;
    const cancelling = action === "CANCEL";
    const confirmed = await dialog.confirm({
      title: cancelling ? `Cancel AGENCIE access for ${agencyName}?` : `Suspend AGENCIE access for ${agencyName}?`,
      description: cancelling
        ? "Users in this organisation will no longer be able to use the workspace. Existing data will be preserved."
        : "Users in this organisation will immediately lose workspace access. Existing data and entitlement dates will be preserved.",
      confirmText: cancelling ? "Cancel access" : "Suspend access",
      cancelText: cancelling ? "Keep access" : "Keep active",
      variant: cancelling ? "danger" : "warning",
      isDestructive: cancelling,
    });
    await runConfirmedEntitlementAction({
      confirmed,
      payload: entitlementActionPayload(subscription, cancelling ? "CANCELLED" : "SUSPENDED"),
      mutate: mutation.mutateAsync,
    });
  }

  function reactivate() {
    if (!subscription) return;
    const values = {
      ...initial,
      status: reactivationStatus,
      trialEndsAt: reactivationTrialEnd,
      endsAt: reactivationEnd,
    };
    const error = validateReactivation(values);
    setValidationError(error);
    if (!error) mutation.mutate(entitlementPatchPayload(values));
  }

  const actions = entitlementActions(subscription?.status ?? null);
  return <><section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><h2 className="font-semibold">Manual entitlement</h2><div className="mt-5 grid gap-4 md:grid-cols-4"><label className="text-sm text-zinc-400">Status<select value={status} onChange={(e) => { setStatus(e.target.value as SubscriptionStatus); setValidationError(null); }} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white">{SUBSCRIPTION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-sm text-zinc-400">Plan<input value={plan} onChange={(e) => setPlan(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white" /></label><label className="text-sm text-zinc-400">Trial end<input type="datetime-local" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white" /></label><label className="text-sm text-zinc-400">Subscription end<input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white" /></label></div><button onClick={saveEntitlement} disabled={mutation.isPending} className="mt-5 rounded-xl bg-indigo-500 text-white px-5 py-3 text-md font-semibold disabled:opacity-50">{mutation.isPending ? "Saving…" : "Save entitlement"}</button>{validationError && <p className="mt-3 text-sm text-red-300">{validationError}</p>}{mutation.error && <p className="mt-3 text-sm text-red-300">{mutation.error.message}</p>}{mutation.isSuccess && <p className="mt-3 text-sm text-emerald-300">Entitlement updated and audited.</p>}</section>{actions.length > 0 && <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><h2 className="font-semibold">Entitlement actions</h2><p className="mt-2 text-sm text-zinc-500">Operational shortcuts preserve agency data, memberships, and entitlement history.</p><div className="mt-5 flex flex-wrap gap-3">{actions.includes("SUSPEND") && <button disabled={mutation.isPending} onClick={() => void confirmAction("SUSPEND")} className="rounded-xl border border-amber-700/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-900">Suspend access</button>}{actions.includes("REACTIVATE") && <button disabled={mutation.isPending} onClick={() => setReactivating(true)} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white">Reactivate access</button>}{actions.includes("CANCEL") && <button disabled={mutation.isPending} onClick={() => void confirmAction("CANCEL")} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300">Cancel access</button>}</div>{reactivating && <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-sm text-zinc-300">Choose how to reactivate. No billing action will be created.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-sm text-zinc-400">New status<select value={reactivationStatus} onChange={(e) => { setReactivationStatus(e.target.value as SubscriptionStatus); setValidationError(null); }} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"><option value="ACTIVE">ACTIVE</option><option value="TRIAL">TRIAL</option></select></label>{reactivationStatus === "TRIAL" && <label className="text-sm text-zinc-400">New trial end<input type="datetime-local" value={reactivationTrialEnd} onChange={(e) => setReactivationTrialEnd(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white" /></label>}{reactivationStatus === "ACTIVE" && <label className="text-sm text-zinc-400">Subscription end<input type="datetime-local" value={reactivationEnd} onChange={(e) => setReactivationEnd(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white" /></label>}</div><div className="mt-4 flex gap-3"><button onClick={reactivate} disabled={mutation.isPending} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white">Confirm reactivation</button><button onClick={() => setReactivating(false)} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300">Keep suspended</button></div></div>}</section>}</>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#09090b] px-6 py-8 text-zinc-100"><div className="mx-auto max-w-7xl">{children}</div></main>; }
