"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAgency } from "@/components/AgencyProvider";
import { getCampaigns, Campaign } from "@/lib/api/campaigns";
import { getClients, Client } from "@/lib/api/clients";
import { useRouter } from "next/navigation";
import { statusPillClasses } from "@/lib/status-style";

export default function CampaignsPage() {
  const { agencyId, agencySlug } = useAgency();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filters, setFilters] = useState({ search: "", clientId: "", status: "" });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;

    Promise.all([getCampaigns(agencyId), getClients(agencyId)])
      .then(([campaignData, clientData]) => {
        if (isMounted) {
          setCampaigns(campaignData);
          setClients(clientData);
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

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const filteredCampaigns = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const client = clientById.get(campaign.clientId);
      const matchesSearch = !search || [campaign.name, campaign.objectives, campaign.brief, client?.name].some((value) => value?.toLowerCase().includes(search));
      const matchesClient = !filters.clientId || campaign.clientId === filters.clientId;
      const matchesStatus = !filters.status || campaign.status === filters.status;
      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [campaigns, clientById, filters]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Initiatives</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Campaigns</h1>
          <Link href="/help/campaigns/campaign-planning" className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            Learn how campaigns work
          </Link>
        </div>
        <button 
          onClick={() => router.push(`/${agencySlug}/campaigns/new`)}
          className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Create Campaign
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search campaigns" className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-span-2" />
          <select value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All clients</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.displayName || client.name}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900/80 p-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">No campaigns yet</h3>
            <p className="mt-2 text-sm text-zinc-400">Launch your first campaign for a client.</p>
            <button 
              onClick={() => router.push(`/${agencySlug}/campaigns/new`)}
              className="mt-6 rounded-full bg-zinc-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Create Campaign
            </button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">No campaigns match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-4 pr-6 font-medium">Name</th>
                  <th className="pb-4 pr-6 font-medium">Client</th>
                  <th className="pb-4 pr-6 font-medium">Status</th>
                  <th className="pb-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => router.push(`/${agencySlug}/campaigns/${campaign.id}`)}
                    className="cursor-pointer transition-colors hover:bg-zinc-900/30"
                  >
                    <td className="py-4 pr-6 font-medium text-zinc-200">{campaign.name}</td>
                    <td className="py-4 pr-6">{clientById.get(campaign.clientId)?.displayName || clientById.get(campaign.clientId)?.name || campaign.clientId.slice(0, 8)}</td>
                    <td className="py-4 pr-6">
                      <span className={statusPillClasses(campaign.status, "sm")}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/${agencySlug}/campaigns/${campaign.id}`);
                        }}
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
