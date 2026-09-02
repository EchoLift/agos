"use client";

import { Agency } from "@/lib/api/organization";

export default function WorkspaceEntitlementBlocked({ agency }: { agency: Agency }) {
  const isAdmin = agency.role === "OWNER" || agency.role === "ADMIN" ||
    agency.roles?.some((role) => role.key === "OWNER" || role.key === "ADMIN");
  const entitlement = agency.entitlement;
  const expiry = entitlement?.trialEndsAt || entitlement?.endsAt;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-6 text-zinc-100">
      <section className="w-full max-w-xl rounded-3xl border border-amber-400/20 bg-zinc-950 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">Workspace access paused</p>
        <h1 className="mt-4 text-3xl font-semibold">AGENCIE access is not active for this organisation.</h1>
        <p className="mt-4 leading-7 text-zinc-400">
          {isAdmin
            ? "Your organisation currently has no usable AGENCIE entitlement. Access is managed manually during the pilot period."
            : "Your organisation currently does not have active AGENCIE access. Please contact your organisation administrator."}
        </p>
        {isAdmin && (
          <dl className="mt-6 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Status</dt><dd>{entitlement?.status ?? "Not configured"}</dd></div>
            {entitlement?.plan && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Plan</dt><dd>{entitlement.plan}</dd></div>}
            {expiry && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Access end</dt><dd>{new Date(expiry).toLocaleString()}</dd></div>}
          </dl>
        )}
      </section>
    </main>
  );
}
