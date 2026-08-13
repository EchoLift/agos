"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgency } from "@/components/AgencyProvider";
import { getContentAssets, ContentAsset } from "@/lib/api/content";
import { getCampaigns, Campaign } from "@/lib/api/campaigns";
import { getClients, Client } from "@/lib/api/clients";
import { useRouter } from "next/navigation";
import { formatLabel, statusPillClasses } from "@/lib/status-style";

export default function ContentPage() {
  const { agencyId, agencySlug } = useAgency();
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState({ search: "", clientId: "", campaignId: "", type: "", status: "" });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;

    Promise.all([getContentAssets(agencyId), getClients(agencyId), getCampaigns(agencyId)])
      .then(([contentData, clientData, campaignData]) => {
        if (isMounted) {
          setContentAssets(contentData);
          setClients(clientData);
          setCampaigns(campaignData);
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
  const campaignById = useMemo(() => new Map(campaigns.map((campaign) => [campaign.id, campaign])), [campaigns]);
  const types = useMemo(() => Array.from(new Set(contentAssets.map((asset) => asset.type))).sort(), [contentAssets]);
  const statuses = useMemo(() => Array.from(new Set(contentAssets.map((asset) => asset.status))).sort(), [contentAssets]);
  const filteredAssets = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return contentAssets.filter((asset) => {
      const client = clientById.get(asset.clientId);
      const campaign = campaignById.get(asset.campaignId);
      const matchesSearch = !search || [asset.title, asset.displayCode, asset.brief, client?.name, campaign?.name].some((value) => value?.toLowerCase().includes(search));
      const matchesClient = !filters.clientId || asset.clientId === filters.clientId;
      const matchesCampaign = !filters.campaignId || asset.campaignId === filters.campaignId;
      const matchesType = !filters.type || asset.type === filters.type;
      const matchesStatus = !filters.status || asset.status === filters.status;
      return matchesSearch && matchesClient && matchesCampaign && matchesType && matchesStatus;
    });
  }, [campaignById, clientById, contentAssets, filters]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Production</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Content</h1>
        </div>
        <button
          onClick={() => router.push(`/content/new`)}
          className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Create Content
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-6">
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search content" className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-span-2" />
          <select value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value, campaignId: "" }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All clients</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.displayName || client.name}</option>)}
          </select>
          <select value={filters.campaignId} onChange={(event) => setFilters((current) => ({ ...current, campaignId: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All campaigns</option>
            {campaigns.filter((campaign) => !filters.clientId || campaign.clientId === filters.clientId).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All status</option>
            {statuses.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading content...</div>
        ) : contentAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900/80 p-4">
              <span className="text-2xl">📝</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">No content yet</h3>
            <p className="mt-2 text-sm text-zinc-400">Start creating deliverables for your campaigns.</p>
            <button
              onClick={() => router.push(`/content/new`)}
              className="mt-6 rounded-full bg-zinc-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Create Content
            </button>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">No content matches these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-4 pr-6 font-medium">Title</th>
                  <th className="pb-4 pr-6 font-medium">Format</th>
                  <th className="pb-4 pr-6 font-medium">Stage</th>
                  <th className="pb-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => router.push(`/content/${asset.id}`)}
                    className="cursor-pointer transition-colors hover:bg-zinc-900/30"
                  >
                    <td className="py-4 pr-6 font-medium text-zinc-200">{asset.title}</td>
                    <td className="py-4 pr-6">{asset.type}</td>
                    <td className="py-4 pr-6">
                      <span className={statusPillClasses(asset.stage || asset.status, "sm")}>
                        {formatLabel(asset.stage || asset.status)}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/content/${asset.id}`);
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
