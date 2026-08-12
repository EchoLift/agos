"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agency } from "@/lib/api/organization";
import { getClients } from "@/lib/api/clients";
import { getCampaigns } from "@/lib/api/campaigns";
import { getContentAssets } from "@/lib/api/content";
import { getWorkOrders } from "@/lib/api/work-orders";
import { getWorkflowBoard } from "@/lib/api/workflow";
import { getMembers } from "@/lib/api/team";
import { getCalendarEvents } from "@/lib/api/calendar";
import { allowedNavKeys, visibleWorkspaceNavItems } from "@/lib/workspace-access";

type SearchResultType = "PAGE" | "CLIENT" | "CAMPAIGN" | "CONTENT" | "WORKFLOW" | "GIG" | "MEMBER" | "CALENDAR" | "HELP";

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}

const helpResults: SearchResult[] = [
  { id: "help-getting-started", type: "HELP", title: "Getting started", subtitle: "Set up your agency and first client", href: "/help/getting-started/what-is-agos" },
  { id: "help-workflow", type: "HELP", title: "How Workflow works", subtitle: "Submissions, handoffs, reviews, and approvals", href: "/help/daily-operations/workflow" },
  { id: "help-calendar", type: "HELP", title: "How AGOS Calendar works", subtitle: "Role-aware deadlines and publishing", href: "/help/daily-operations/calendar" },
  { id: "help-gigs", type: "HELP", title: "When to use Gigs", subtitle: "Assign one-off work without a campaign", href: "/help/gigs/when-to-use-gigs" },
  { id: "help-roles", type: "HELP", title: "Roles and access", subtitle: "Understand workspace permissions", href: "/help/team-access/roles" },
];

export default function GlobalSearch({
  agency,
  agencySlug,
  userId,
  open,
  onOpenChange,
}: {
  agency: Agency | null;
  agencySlug: string;
  userId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navKeys = useMemo(() => allowedNavKeys(agency, userId), [agency, userId]);
  const pageResults = useMemo<SearchResult[]>(
    () => visibleWorkspaceNavItems(agency, agencySlug, userId).map((item) => ({
      id: `page-${item.key}`,
      type: "PAGE",
      title: item.label,
      subtitle: "Page",
      href: item.hrefValue,
    })),
    [agency, agencySlug, userId],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !agency?.id || query.trim().length < 2) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const needle = query.trim().toLowerCase();
      const requests: Array<Promise<SearchResult[]>> = [];

      if (navKeys.has("clients")) {
        requests.push(getClients(agency.id).then((items) => items
          .filter((item) => `${item.name} ${item.displayName ?? ""} ${item.industry ?? ""}`.toLowerCase().includes(needle))
          .slice(0, 6)
          .map((item) => ({ id: item.id, type: "CLIENT" as const, title: item.displayName || item.name, subtitle: item.industry || "Client", href: `/${agencySlug}/clients/${item.id}` }))));
      }
      if (navKeys.has("campaigns")) {
        requests.push(getCampaigns(agency.id).then((items) => items
          .filter((item) => `${item.name} ${item.client?.name ?? ""}`.toLowerCase().includes(needle))
          .slice(0, 6)
          .map((item) => ({ id: item.id, type: "CAMPAIGN" as const, title: item.name, subtitle: item.client?.name || "Campaign", href: `/${agencySlug}/campaigns/${item.id}` }))));
      }
      if (navKeys.has("content")) {
        requests.push(getContentAssets(agency.id).then((items) => items
          .filter((item) => `${item.displayCode ?? ""} ${item.title} ${item.stage ?? ""}`.toLowerCase().includes(needle))
          .slice(0, 6)
          .map((item) => ({ id: item.id, type: "CONTENT" as const, title: `${item.displayCode ?? item.type} - ${item.title}`, subtitle: item.stage || "Content", href: `/${agencySlug}/content/${item.id}` }))));
      }
      if (navKeys.has("gigs")) {
        requests.push(getWorkOrders(agency.id).then((items) => items
          .filter((item) => `${item.title} ${item.client?.name ?? ""} ${item.workType}`.toLowerCase().includes(needle))
          .slice(0, 6)
          .map((item) => ({ id: item.id, type: "GIG" as const, title: item.title, subtitle: `${item.workType} · ${item.client?.name ?? "No client"}`, href: `/${agencySlug}/gigs/${item.id}` }))));
      }
      if (navKeys.has("workflow")) {
        requests.push(getWorkflowBoard(agency.id, { search: query.trim() }).then((board) => board.columns
          .flatMap((column) => column.items)
          .slice(0, 8)
          .map((item) => ({ id: item.contentAssetId, type: "WORKFLOW" as const, title: `${item.displayCode} - ${item.title}`, subtitle: `${item.clientName} · ${item.stage}`, href: `/${agencySlug}/workflow/${item.contentAssetId}` }))));
      }
      if (navKeys.has("calendar")) {
        requests.push(getCalendarEvents(agency.id, { scope: "MY_SCHEDULE" }).then((calendar) => calendar.events
          .filter((item) => `${item.title} ${item.campaign?.name ?? ""} ${item.client?.name ?? ""} ${item.contentAsset?.displayCode ?? ""} ${item.workOrder?.title ?? ""}`.toLowerCase().includes(needle))
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            type: "CALENDAR" as const,
            title: item.title,
            subtitle: `${item.eventType.replaceAll("_", " ")} · ${new Date(item.startsAt).toLocaleString()}`,
            href: item.contentAsset
              ? `/${agencySlug}/workflow/${item.contentAsset.id}`
              : item.workOrder
                ? `/${agencySlug}/gigs/${item.workOrder.id}`
                : item.campaign
                  ? `/${agencySlug}/campaigns/${item.campaign.id}`
                  : `/${agencySlug}/calendar`,
          }))));
      }
      if (navKeys.has("team")) {
        requests.push(getMembers(agency.id).then((items) => items
          .filter((item) => `${item.name ?? ""} ${item.email ?? ""} ${item.roleName}`.toLowerCase().includes(needle))
          .slice(0, 6)
          .map((item) => ({ id: item.id, type: "MEMBER" as const, title: item.name || "Team member", subtitle: item.roles?.map((role) => role.name).join(", ") || item.roleName, href: `/${agencySlug}/team` }))));
      }

      const settled = await Promise.allSettled(requests);
      if (!active) return;
      setRemoteResults(settled.flatMap((result) => result.status === "fulfilled" ? result.value : []));
      setLoading(false);
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [agency?.id, agencySlug, navKeys, open, query]);

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const canSearchWorkspace = Boolean(open && agency?.id && needle.length >= 2);
  const localResults = [...pageResults, ...helpResults].filter((item) =>
    !needle || `${item.title} ${item.subtitle}`.toLowerCase().includes(needle),
  );
  const results = [...localResults, ...(canSearchWorkspace ? remoteResults : [])];
  const grouped = Array.from(new Set(results.map((item) => item.type))).map((type) => ({
    type,
    items: results.filter((item) => item.type === type),
  }));

  const followResult = (result: SearchResult) => {
    onOpenChange(false);
    setQuery("");
    router.push(result.href);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search AGOS">
      <button className="absolute inset-0 cursor-default" aria-label="Close search" onClick={() => onOpenChange(false)} />
      <section className="relative flex h-full w-full flex-col bg-zinc-950 md:mx-auto md:mt-[8vh] md:h-auto md:max-h-[76vh] md:max-w-2xl md:rounded-lg md:border md:border-zinc-800 md:shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search AGOS..."
            className="min-h-11 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-base text-white outline-none focus:border-indigo-500"
          />
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-11 rounded-md px-3 text-sm text-zinc-300 hover:bg-zinc-900">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {canSearchWorkspace && loading ? <p className="py-3 text-sm text-zinc-500">Searching this workspace...</p> : null}
          {(!canSearchWorkspace || !loading) && results.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No accessible results match this search.</div>
          ) : null}
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.type}>
                <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">{formatType(group.type)}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button key={`${item.type}-${item.id}`} type="button" onClick={() => followResult(item)} className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-zinc-900">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-100">{item.title}</span>
                        <span className="block truncate text-xs text-zinc-500">{item.subtitle}</span>
                      </span>
                      <span className="ml-3 text-xs text-zinc-600">Open</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden border-t border-zinc-800 px-3 py-2 text-xs text-zinc-600 md:block">Press Esc to close · Cmd/Ctrl + K from anywhere</div>
      </section>
    </div>
  );
}

function formatType(type: SearchResultType) {
  const labels: Record<SearchResultType, string> = {
    PAGE: "Quick navigation",
    CLIENT: "Clients",
    CAMPAIGN: "Campaigns",
    CONTENT: "Content",
    WORKFLOW: "Workflow",
    GIG: "Gigs",
    MEMBER: "People",
    CALENDAR: "Calendar",
    HELP: "Help",
  };
  return labels[type];
}
