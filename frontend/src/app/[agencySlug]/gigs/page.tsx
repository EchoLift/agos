"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAgency } from "@/components/AgencyProvider";
import { getWorkOrders, WorkOrder } from "@/lib/api/work-orders";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { hasAnyRole } from "@/lib/workspace-access";

export default function GigsPage() {
  const { agency, agencyId, agencySlug } = useAgency();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const canCreate = hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]);

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;
    getWorkOrders(agencyId)
      .then((data) => {
        if (isMounted) setWorkOrders(data);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId]);

  const filtered = useMemo(
    () =>
      workOrders.filter((gig) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          gig.title.toLowerCase().includes(query) ||
          gig.description.toLowerCase().includes(query) ||
          gig.client?.name.toLowerCase().includes(query);
        const matchesStatus = !status || gig.status === status;
        return matchesSearch && matchesStatus;
      }),
    [search, status, workOrders],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Work orders</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Gigs</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Fast one-off assignments for scripts, edits, shoots, designs, and overflow work.
          </p>
          <Link href="/help/gigs/when-to-use-gigs" className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            When should I use a Gig?
          </Link>
        </div>
        {canCreate ? (
          <Link href={`/${agencySlug}/gigs/new`} className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
            New Gig
          </Link>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gigs, clients, instructions"
            className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">All status</option>
            {["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "CHANGES_REQUESTED", "COMPLETED", "CANCELLED"].map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading gigs...</p>
        ) : filtered.length ? (
          <div className="divide-y divide-zinc-800">
            {filtered.map((gig) => (
              <Link
                key={gig.id}
                href={`/${agencySlug}/gigs/${gig.id}`}
                className="grid gap-3 py-4 transition hover:bg-zinc-900/50 md:grid-cols-[1fr_160px_180px_150px]"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{gig.title}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{gig.client?.name ?? "No client"} · {formatLabel(gig.workType)}</p>
                </div>
                <div className="text-sm text-zinc-400">{gig.assignee?.name ?? "Unassigned"}</div>
                <div className="text-sm text-zinc-400">{formatDateTime(gig.dueAt)}</div>
                <div>
                  <span className={statusPillClasses(gig.status, "sm")}>{formatLabel(gig.status)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-400">
            No gigs match this view.
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
