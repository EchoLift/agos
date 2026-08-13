"use client";

import Link from "next/link";
import { useAgency } from "@/components/AgencyProvider";

const plannedSettings = [
  "Workspace defaults",
  "Approval rules",
  "Notification routing",
  "Client portal branding",
  "Billing",
  "Integrations",
];

export default function AgencySettingsPage() {
  const { agency, agencySlug, agencyDisplayName } = useAgency();
  const isOwner = agency?.roles?.some((role) => role.key === "OWNER") || agency?.role === "OWNER";

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Agency Settings</h1>
          <p className="mt-2 text-sm text-zinc-400">Only owners can manage agency settings.</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm leading-6 text-zinc-400">
            You can still manage your profile, status, and assigned work from this workspace.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Agency Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">Owner controls for this agency. Team roles stay on the Team page.</p>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnly label="Display Name" value={agencyDisplayName || agency?.displayName || "Not available"} />
          <ReadOnly label="Agency Name" value={agency?.name || "Not available"} />
          <ReadOnly label="Workspace Slug" value={agency?.slug || "Not available"} />
          <ReadOnly label="Your Access" value={agency?.roles?.map((role) => role.name).join(", ") || agency?.role || "Owner"} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/team`}
          className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 transition hover:bg-zinc-900/30"
        >
          <div className="text-base font-semibold text-white">Team & Roles</div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Invite members, edit skills, and remove inactive employees.</p>
        </Link>
        <Link
          href={`/settings/appearance`}
          className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 transition hover:bg-zinc-900/30"
        >
          <div className="text-base font-semibold text-white">Appearance</div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Switch between dark and light workspace themes.</p>
        </Link>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Coming Later</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {plannedSettings.map((setting) => (
            <div key={setting} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-zinc-400">
              {setting}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-2 truncate text-sm text-zinc-300">{value}</div>
    </div>
  );
}
