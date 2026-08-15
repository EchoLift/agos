"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { useCampaignsQuery, useClientsQuery, useContentQuery } from "@/lib/query";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { getWorkspaceHref } from "@/lib/workspace-url";

export default function ContentLibraryPage() {
  const router = useRouter();
  const { agencyId, agencySlug } = useAgency();
  const safeAgencySlug = agencySlug ?? "";
  const [filters, setFilters] = useState({
    search: "",
    clientId: "",
    campaignId: "",
    status: "",
  });
  const contentQuery = useContentQuery(agencyId);
  const clientsQuery = useClientsQuery(agencyId);
  const campaignsQuery = useCampaignsQuery(agencyId);
  const contentAssets = useMemo(
    () => contentQuery.data ?? [],
    [contentQuery.data],
  );
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const campaigns = useMemo(
    () => campaignsQuery.data ?? [],
    [campaignsQuery.data],
  );
  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns],
  );
  const statuses = useMemo(
    () => Array.from(new Set(contentAssets.map((asset) => asset.status))).sort(),
    [contentAssets],
  );
  const filteredAssets = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return contentAssets.filter((asset) => {
      const client = clientById.get(asset.clientId);
      const campaign = campaignById.get(asset.campaignId);
      const matchesSearch =
        !search ||
        [
          asset.title,
          asset.displayCode,
          asset.brief,
          client?.name,
          client?.displayName,
          campaign?.name,
        ].some((value) => value?.toLowerCase().includes(search));
      const matchesClient = !filters.clientId || asset.clientId === filters.clientId;
      const matchesCampaign =
        !filters.campaignId || asset.campaignId === filters.campaignId;
      const matchesStatus = !filters.status || asset.status === filters.status;
      return matchesSearch && matchesClient && matchesCampaign && matchesStatus;
    });
  }, [campaignById, clientById, contentAssets, filters]);
  const isLoading =
    (contentQuery.isLoading || clientsQuery.isLoading || campaignsQuery.isLoading) &&
    !contentQuery.data &&
    !clientsQuery.data &&
    !campaignsQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Internal Library
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Content
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse content across campaigns. New planning starts from a campaign Content tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(getWorkspaceHref(safeAgencySlug, "/campaigns"))}
          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Open Campaigns
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-5">
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Search content"
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
          />
          <select
            value={filters.clientId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                clientId: event.target.value,
                campaignId: "",
              }))
            }
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName || client.name}
              </option>
            ))}
          </select>
          <select
            value={filters.campaignId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, campaignId: event.target.value }))
            }
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All campaigns</option>
            {campaigns
              .filter((campaign) => !filters.clientId || campaign.clientId === filters.clientId)
              .map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">Loading content...</div>
        ) : contentQuery.error || clientsQuery.error || campaignsQuery.error ? (
          <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to load content.
          </div>
        ) : filteredAssets.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Campaign</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() =>
                      router.push(
                        getWorkspaceHref(
                          safeAgencySlug,
                          `/campaigns/${asset.campaignId}?tab=content`,
                        ),
                      )
                    }
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-950">
                      {asset.displayCode ? `${asset.displayCode} · ` : ""}
                      {asset.title}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {campaignById.get(asset.campaignId)?.name || "Campaign"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatLabel(asset.type)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={statusPillClasses(asset.stage || asset.status, "sm")}>
                        {formatLabel(asset.stage || asset.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            No content matches these filters.
          </div>
        )}
      </div>
    </div>
  );
}
