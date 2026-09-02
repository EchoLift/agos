"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPlatformAgencies, getPlatformOverview } from "@/lib/api/platform-admin";

export default function PlatformAdminPage() {
  const overview = useQuery({ queryKey: ["platform-admin", "overview"], queryFn: getPlatformOverview });
  const agencies = useQuery({ queryKey: ["platform-admin", "agencies", 1], queryFn: () => getPlatformAgencies(1) });
  const error = overview.error || agencies.error;
  if (error) return <AdminShell><p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">{error instanceof Error ? error.message : "Platform admin access failed."}</p></AdminShell>;
  if (!overview.data || !agencies.data) return <AdminShell><p className="text-zinc-400">Loading platform overview…</p></AdminShell>;

  const metrics = [
    ["Agencies", overview.data.totalAgencies], ["Entitled", overview.data.entitledAgencies],
    ["Trials", overview.data.trialAgencies], ["Suspended", overview.data.suspendedAgencies],
    ["Users", overview.data.totalUsers], ["Memberships", overview.data.totalMemberships],
  ];
  return <AdminShell>
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 p-5"><h2 className="font-semibold">Agencies</h2></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-zinc-500"><tr>{["Agency", "Entitlement", "Plan", "Members", "Last activity", "Created"].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{agencies.data.items.map((agency) => <tr key={agency.id} className="border-t border-zinc-900"><td className="px-5 py-4"><Link className="font-medium text-indigo-300 hover:text-indigo-200" href={`/platform-admin/${agency.id}`}>{agency.displayName || agency.name}</Link><p className="text-xs text-zinc-600">{agency.slug}</p></td><td className="px-5 py-4">{agency.subscription?.status ?? "None"}</td><td className="px-5 py-4">{agency.subscription?.plan ?? "—"}</td><td className="px-5 py-4">{agency.memberCount}</td><td className="px-5 py-4">{agency.lastActivity ? `${agency.lastActivity.eventType} · ${new Date(agency.lastActivity.createdAt).toLocaleDateString()}` : "Unavailable"}</td><td className="px-5 py-4">{new Date(agency.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
    </section>
  </AdminShell>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#09090b] px-6 py-8 text-zinc-100"><div className="mx-auto max-w-7xl"><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">Internal</p><h1 className="mt-2 text-3xl font-semibold">AGENCIE platform admin</h1></header>{children}</div></main>;
}
