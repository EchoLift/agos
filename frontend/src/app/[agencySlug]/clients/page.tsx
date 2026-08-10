"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAgency } from "@/components/AgencyProvider";
import { getClients, Client } from "@/lib/api/clients";
import { useRouter } from "next/navigation";
import { industryOptions } from "@/lib/client-options";
import { statusPillClasses } from "@/lib/status-style";

export default function ClientsPage() {
  const { agencyId, agencySlug } = useAgency();
  const [clients, setClients] = useState<Client[]>([]);
  const [filters, setFilters] = useState({ search: "", industry: "", status: "" });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;

    getClients(agencyId)
      .then((data) => {
        if (isMounted) {
          setClients(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId]);

  const filteredClients = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = !search || [client.name, client.displayName, client.primaryContactName, client.primaryContactEmail].some((value) => value?.toLowerCase().includes(search));
      const matchesIndustry = !filters.industry || client.industry === filters.industry;
      const matchesStatus = !filters.status || client.status === filters.status;
      return matchesSearch && matchesIndustry && matchesStatus;
    });
  }, [clients, filters]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Directory</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Clients</h1>
          <Link href="/help/clients/client-playbook" className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            What belongs in a client playbook?
          </Link>
        </div>
        <button 
          onClick={() => router.push(`/${agencySlug}/clients/new`)}
          className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Create Client
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search clients or contacts" className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-span-2" />
          <select value={filters.industry} onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All industries</option>
            {industryOptions.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="DELETED">Deleted</option>
          </select>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900/80 p-4">
              <span className="text-2xl">🤝</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">No clients yet</h3>
            <p className="mt-2 text-sm text-zinc-400">Add your first client to start organizing campaigns and content.</p>
            <button 
              onClick={() => router.push(`/${agencySlug}/clients/new`)}
              className="mt-6 rounded-full bg-zinc-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Create Client
            </button>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">No clients match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-4 pr-6 font-medium">Name</th>
                  <th className="pb-4 pr-6 font-medium">Industry</th>
                  <th className="pb-4 pr-6 font-medium">Status</th>
                  <th className="pb-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-zinc-900/30">
                    <td className="py-4 pr-6 font-medium text-zinc-200">{client.name}</td>
                    <td className="py-4 pr-6">{client.industry || "—"}</td>
                    <td className="py-4 pr-6">
                      <span className={statusPillClasses(client.status, "sm")}>
                        {client.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() => router.push(`/${agencySlug}/clients/${client.id}`)}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
