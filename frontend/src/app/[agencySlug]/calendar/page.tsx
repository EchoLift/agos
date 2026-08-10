"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IlamyCalendar, CalendarEvent as IlamyCalendarEvent } from "@ilamy/calendar";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { CalendarEvent, CalendarScope, getCalendarEvents } from "@/lib/api/calendar";
import { Campaign, getCampaigns } from "@/lib/api/campaigns";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { agencyStorageKey } from "@/lib/workspace-cache";

const scopeOptions: Array<{ value: CalendarScope; label: string }> = [
  { value: "MY_SCHEDULE", label: "My Schedule" },
  { value: "MY_ROLE", label: "My Role" },
  { value: "MY_TEAM", label: "My Team" },
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "AGENCY", label: "Everyone" },
];

const calendarTypes = [
  { value: "WORKFLOW_TASK", label: "My Tasks" },
  { value: "WORK_ORDER", label: "Gigs" },
  { value: "PUBLISHING", label: "Publishing" },
  { value: "SHOOT", label: "Shoots" },
  { value: "REVIEW", label: "Reviews" },
  { value: "APPROVAL", label: "Approvals" },
  { value: "CAMPAIGN_MILESTONE", label: "Campaign Milestones" },
  { value: "CLIENT_MEETING", label: "Client Meetings" },
  { value: "TEAM_EVENT", label: "Team Events" },
];

const defaultVisibleTypes = ["WORKFLOW_TASK", "WORK_ORDER", "PUBLISHING", "SHOOT", "REVIEW", "APPROVAL"];

export default function CalendarPage() {
  const { agencyId, agency, agencySlug } = useAgency();
  const router = useRouter();
  const roleKeys = useMemo(() => [agency?.role, ...(agency?.roles?.map((role) => role.key) || [])].filter(Boolean), [agency]);
  const isOwnerOrManager = useMemo(() => roleKeys.includes("OWNER") || roleKeys.includes("MANAGER"), [roleKeys]);
  const defaultScope = useMemo<CalendarScope>(() => {
    if (roleKeys.includes("OWNER")) return "AGENCY";
    if (roleKeys.includes("MANAGER")) return "MY_TEAM";
    return "MY_SCHEDULE";
  }, [roleKeys]);
  const allowedScopeOptions = useMemo(() => {
    if (isOwnerOrManager) return scopeOptions;
    return scopeOptions.filter((option) => option.value === "MY_SCHEDULE");
  }, [isOwnerOrManager]);

  const [scopeOverride, setScopeOverride] = useState<CalendarScope | "">("");
  const [range, setRange] = useState(() => currentMonthRange());
  const [campaignId, setCampaignId] = useState("");
  const [visibleTypes, setVisibleTypes] = useState<string[]>(defaultVisibleTypes);
  const [calendar, setCalendar] = useState<{ events: CalendarEvent[]; summary: { total: number; assignedToMe: number; publishing: number; overdue: number } } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestedScope = scopeOverride || defaultScope;
  const selectedScope = allowedScopeOptions.some((option) => option.value === requestedScope) ? requestedScope : defaultScope;
  const visibleTypesStorageKey = useMemo(() => agencyStorageKey(agencyId, "calendar.visibleTypes"), [agencyId]);
  const visibleTypesVersionKey = useMemo(() => agencyStorageKey(agencyId, "calendar.visibleTypesVersion"), [agencyId]);

  useEffect(() => {
    const legacyStored = window.localStorage.getItem("agos.calendar.visibleTypes");
    const stored = window.localStorage.getItem(visibleTypesStorageKey) ?? legacyStored;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const knownTypes = new Set(calendarTypes.map((type) => type.value));
          const restoredTypes = parsed.filter((type) => knownTypes.has(type));
          const hasCurrentDefaults =
            window.localStorage.getItem(visibleTypesVersionKey) === "2";
          const missingDefaultTypes = hasCurrentDefaults
            ? []
            : defaultVisibleTypes.filter((type) => !restoredTypes.includes(type));
          queueMicrotask(() =>
            setVisibleTypes([...restoredTypes, ...missingDefaultTypes]),
          );
          window.localStorage.setItem(visibleTypesVersionKey, "2");
        }
      } catch {
        window.localStorage.removeItem(visibleTypesStorageKey);
      }
    }
    window.localStorage.removeItem("agos.calendar.visibleTypes");
  }, [visibleTypesStorageKey, visibleTypesVersionKey]);

  useEffect(() => {
    window.localStorage.setItem(visibleTypesStorageKey, JSON.stringify(visibleTypes));
  }, [visibleTypes, visibleTypesStorageKey]);

  useEffect(() => {
    if (!agencyId) return;
    getCampaigns(agencyId).then(setCampaigns).catch(console.error);
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;

    const loadCalendar = async () => {
      setIsLoading(true);
      try {
        const data = await getCalendarEvents(agencyId, {
          scope: selectedScope,
          from: range.from,
          to: range.to,
          campaignId: campaignId || undefined,
          eventTypes: visibleTypes,
        });
        if (!isMounted) return;
        setCalendar({ events: data.events, summary: data.summary });
        setError(null);
      } catch (err: unknown) {
        if (!isMounted) return;
        setCalendar(null);
        setError(err instanceof Error ? err.message : "Failed to load calendar.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadCalendar();

    return () => {
      isMounted = false;
    };
  }, [agencyId, campaignId, range, selectedScope, visibleTypes]);

  const groupedEvents = useMemo(() => groupEvents(calendar?.events || []), [calendar]);
  const calendarEvents = useMemo(() => toIlamyEvents(calendar?.events || []), [calendar]);

  const openCalendarEvent = (event: CalendarEvent) => {
    if (event.workOrder?.id) {
      router.push(`/${agencySlug}/gigs/${event.workOrder.id}`);
      return;
    }
    if (event.contentAsset?.id) {
      router.push(`/${agencySlug}/workflow/${event.contentAsset.id}`);
      return;
    }
    if (event.campaign?.id) {
      router.push(`/${agencySlug}/campaigns/${event.campaign.id}`);
    }
  };

  const toggleType = (type: string) => {
    setVisibleTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  };

  const resetDefaults = () => {
    setScopeOverride("");
    setCampaignId("");
    setVisibleTypes(defaultVisibleTypes);
    setRange(currentMonthRange());
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Schedule</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Work assigned to you appears here like a meeting invite, with broader schedules available when your role permits it.
          </p>
          <Link href="/help/daily-operations/calendar" className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            How AGOS Calendar works
          </Link>
        </div>
        <button type="button" onClick={resetDefaults} className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">
          Reset to defaults
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Scope</label>
            <select value={selectedScope} onChange={(event) => setScopeOverride(event.target.value as CalendarScope)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
              {allowedScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Campaign</label>
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </div>

          <div className="grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Date Range</label>
            <input type="date" value={range.from.slice(0, 10)} onChange={(event) => setRange((current) => ({ ...current, from: new Date(event.target.value).toISOString() }))} className="date-input rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
            <input type="date" value={range.to.slice(0, 10)} onChange={(event) => setRange((current) => ({ ...current, to: endOfDay(event.target.value).toISOString() }))} className="date-input rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Visible Calendars</div>
            <div className="mt-3 space-y-2">
              {calendarTypes.map((type) => (
                <label key={type.value} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-900/50">
                  <input type="checkbox" checked={visibleTypes.includes(type.value)} onChange={() => toggleType(type.value)} className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500" />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Events" value={calendar?.summary.total || 0} />
            <Metric label="Assigned to me" value={calendar?.summary.assignedToMe || 0} />
            <Metric label="Publishing" value={calendar?.summary.publishing || 0} />
            <Metric label="Overdue" value={calendar?.summary.overdue || 0} tone="danger" />
          </div>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-3 shadow-2xl shadow-black/20 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Calendar View</h2>
                <p className="mt-1 text-sm text-zinc-500">Week, day, month, and year views use the same role-aware events.</p>
              </div>
              <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
                {scopeLabel(selectedScope)}
              </span>
            </div>
            <div className="h-[720px] overflow-hidden rounded-2xl border border-zinc-800 bg-background">
              <IlamyCalendar
                events={calendarEvents}
                initialView="week"
                firstDayOfWeek="monday"
                scrollTime="09:00:00"
                timeFormat="12-hour"
                disableCellClick
                disableDragAndDrop
                eventHeight={42}
                onEventClick={(event) => {
                  const agosEvent = event.data?.agosEvent as CalendarEvent | undefined;
                  if (agosEvent) openCalendarEvent(agosEvent);
                }}
                renderEvent={(event) => <VisualCalendarEvent event={event} />}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Agenda</h2>
                <p className="mt-1 text-sm text-zinc-500">{scopeLabel(selectedScope)} · {formatDate(range.from)} to {formatDate(range.to)}</p>
              </div>
            </div>

            <div className="mt-5">
              {isLoading ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">Loading calendar...</div>
              ) : error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
              ) : groupedEvents.length ? (
                <div className="space-y-6">
                  {groupedEvents.map((group) => (
                    <div key={group.date}>
                      <div className="sticky top-[72px] z-10 bg-background/90 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur">
                        {formatDate(group.date)}
                      </div>
                      <div className="space-y-3">
                        {group.events.map((event) => (
                          <CalendarEventCard key={event.id} event={event} onOpen={() => openCalendarEvent(event)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">No events in this view.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function CalendarEventCard({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4 text-left transition hover:border-indigo-500/40 hover:bg-zinc-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusPillClasses(event.eventType)}>{formatLabel(event.eventType)}</span>
            <span className={statusPillClasses(event.riskStatus)}>{formatLabel(event.riskStatus)}</span>
            {event.forwardedToMe ? <span className={statusPillClasses("ASSIGNED")}>Assigned to me</span> : null}
          </div>
          <h3 className="mt-3 text-base font-semibold text-white">{event.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{formatTime(event.startsAt)} · {event.client?.name || "No client"} · {event.campaign?.name || "Standalone gig"}</p>
          {event.contentAsset ? <p className="mt-2 text-sm text-zinc-300">{event.contentAsset.displayCode} · {event.contentAsset.title}</p> : null}
          {event.workOrder ? <p className="mt-2 text-sm text-zinc-300">{formatLabel(event.workOrder.workType)} · {event.workOrder.title}</p> : null}
        </div>
        <div className="text-right text-sm text-zinc-500">
          <div className={statusPillClasses(event.status)}>{formatLabel(event.status)}</div>
          <div className="mt-1">{event.owner?.name || event.platform || event.reason}</div>
        </div>
      </div>
    </button>
  );
}

function VisualCalendarEvent({ event }: { event: IlamyCalendarEvent }) {
  const agosEvent = event.data?.agosEvent as CalendarEvent | undefined;
  const type = agosEvent?.eventType || "WORKFLOW_TASK";
  const risk = agosEvent?.riskStatus || "ON_TRACK";

  return (
    <div className={`h-full min-h-7 overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] leading-tight ${eventTypeBorderClass(type)} ${risk === "OVERDUE" || risk === "BLOCKED" ? "bg-red-500/15" : "bg-indigo-500/15"}`}>
      <div className="truncate font-semibold text-white">{event.title}</div>
      <div className="truncate text-zinc-300">
        {agosEvent?.contentAsset?.displayCode || agosEvent?.workOrder?.title || formatLabel(type)}
        {agosEvent?.forwardedToMe ? " · Assigned to me" : ""}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className={`mt-4 text-3xl font-semibold ${tone === "danger" ? "text-red-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function currentMonthRange() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function groupEvents(events: CalendarEvent[]) {
  const grouped = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const date = event.startsAt.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) || []), event]);
  });
  return Array.from(grouped.entries()).map(([date, items]) => ({ date, events: items }));
}

function toIlamyEvents(events: CalendarEvent[]): IlamyCalendarEvent[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: dayjs(event.startsAt),
    end: dayjs(event.endsAt || event.startsAt).isAfter(dayjs(event.startsAt))
      ? dayjs(event.endsAt)
      : dayjs(event.startsAt).add(45, "minute"),
    backgroundColor: calendarEventBackground(event),
    color: "#ffffff",
    description: event.reason,
    data: { agosEvent: event },
  }));
}

function scopeLabel(scope: CalendarScope) {
  return scopeOptions.find((option) => option.value === scope)?.label || "Calendar";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function eventTypeBorderClass(type: string) {
  if (type === "PUBLISHING") return "border-emerald-500/30";
  if (type === "SHOOT") return "border-sky-500/30";
  if (type === "REVIEW" || type === "APPROVAL") return "border-amber-500/30";
  return "border-indigo-500/30";
}

function calendarEventBackground(event: CalendarEvent) {
  if (event.riskStatus === "OVERDUE" || event.riskStatus === "BLOCKED") return "rgba(239, 68, 68, 0.2)";
  if (event.eventType === "PUBLISHING") return "rgba(16, 185, 129, 0.2)";
  if (event.eventType === "SHOOT") return "rgba(14, 165, 233, 0.2)";
  if (event.eventType === "REVIEW" || event.eventType === "APPROVAL") return "rgba(245, 158, 11, 0.2)";
  return "rgba(99, 102, 241, 0.2)";
}
