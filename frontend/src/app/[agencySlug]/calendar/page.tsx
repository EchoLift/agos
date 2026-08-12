"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IlamyCalendar, CalendarEvent as IlamyCalendarEvent } from "@ilamy/calendar";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import {
  MobileCalendarExperience,
  MobileCalendarMode,
  MobileRepresentation,
} from "@/components/calendar/MobileCalendarExperience";
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
  const [mobileRepresentation, setMobileRepresentation] = useState<MobileRepresentation>("calendar");
  const [mobileMode, setMobileMode] = useState<MobileCalendarMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [mobilePreferencesReady, setMobilePreferencesReady] = useState(false);

  const requestedScope = scopeOverride || defaultScope;
  const selectedScope = allowedScopeOptions.some((option) => option.value === requestedScope) ? requestedScope : defaultScope;
  const visibleTypesStorageKey = useMemo(() => agencyStorageKey(agencyId, "calendar.visibleTypes"), [agencyId]);
  const visibleTypesVersionKey = useMemo(() => agencyStorageKey(agencyId, "calendar.visibleTypesVersion"), [agencyId]);
  const mobileRepresentationKey = useMemo(
    () => agencyStorageKey(agencyId, `calendar.${agency?.membershipId || "member"}.mobileRepresentation`),
    [agency?.membershipId, agencyId],
  );
  const mobileModeKey = useMemo(
    () => agencyStorageKey(agencyId, `calendar.${agency?.membershipId || "member"}.mobileMode`),
    [agency?.membershipId, agencyId],
  );

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
    const storedRepresentation = window.localStorage.getItem(mobileRepresentationKey);
    const storedMode = window.localStorage.getItem(mobileModeKey);
    queueMicrotask(() => {
      if (storedRepresentation === "calendar" || storedRepresentation === "agenda") {
        setMobileRepresentation(storedRepresentation);
      }
      if (storedMode === "day" || storedMode === "three-day" || storedMode === "week" || storedMode === "month") {
        setMobileMode(storedMode);
      }
      setMobilePreferencesReady(true);
    });
  }, [mobileModeKey, mobileRepresentationKey]);

  useEffect(() => {
    if (!mobilePreferencesReady) return;
    window.localStorage.setItem(mobileRepresentationKey, mobileRepresentation);
    window.localStorage.setItem(mobileModeKey, mobileMode);
  }, [mobileMode, mobileModeKey, mobilePreferencesReady, mobileRepresentation, mobileRepresentationKey]);

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

  const displayedEvents = useMemo(
    () => (calendar?.events || []).filter((event) => {
      if (clientId && event.client?.id !== clientId) return false;
      if (status && event.status !== status) return false;
      return true;
    }),
    [calendar, clientId, status],
  );
  const groupedEvents = useMemo(() => groupEvents(displayedEvents), [displayedEvents]);
  const calendarEvents = useMemo(() => toIlamyEvents(displayedEvents), [displayedEvents]);
  const clients = useMemo(() => uniqueClients(calendar?.events || []), [calendar]);
  const statuses = useMemo(() => uniqueValues((calendar?.events || []).map((event) => event.status)), [calendar]);
  const mobileSummary = useMemo(() => ({
    total: displayedEvents.length,
    publishing: displayedEvents.filter((event) => event.eventType === "PUBLISHING").length,
    overdue: displayedEvents.filter((event) => event.riskStatus === "OVERDUE").length,
  }), [displayedEvents]);

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
    setClientId("");
    setStatus("");
    setSelectedDate(startOfLocalDay(new Date()));
    setMobileRepresentation("calendar");
    setMobileMode("day");
  };

  const selectMobileDate = (date: Date) => {
    const normalized = startOfLocalDay(date);
    setSelectedDate(normalized);
    if (!isDateInRange(normalized, range)) setRange(monthRange(normalized));
  };

  return (
    <div className="space-y-3 lg:space-y-5">
      <div className="hidden flex-wrap items-end justify-between gap-3 lg:flex">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Schedule</p>
          <h1 className="mt-1 text-2xl font-semibold text-white lg:text-3xl">Calendar</h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-400">
            Work assigned to you appears here like a meeting invite, with broader schedules available when your role permits it.
          </p>
          <Link href="/help/daily-operations/calendar" className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            How AGOS Calendar works
          </Link>
        </div>
        <button type="button" onClick={resetDefaults} className="min-h-11 rounded-md border border-zinc-800 px-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 lg:rounded-full">
          Reset to defaults
        </button>
      </div>

      <MobileCalendarExperience
        events={displayedEvents}
        summary={mobileSummary}
        selectedDate={selectedDate}
        representation={mobileRepresentation}
        mode={mobileMode}
        isLoading={isLoading}
        error={error}
        onDateChange={selectMobileDate}
        onRepresentationChange={setMobileRepresentation}
        onModeChange={setMobileMode}
        onOpenFilters={() => setIsFilterOpen(true)}
        onOpenEvent={openCalendarEvent}
      />

      <div className="hidden gap-3 lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <details className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/10 lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-200">
            Calendar filters
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="border-t border-zinc-800 pt-3">
            <CalendarFilters
              selectedScope={selectedScope}
              allowedScopeOptions={allowedScopeOptions}
              onScopeChange={setScopeOverride}
              campaignId={campaignId}
              campaigns={campaigns}
              onCampaignChange={setCampaignId}
              range={range}
              onRangeChange={setRange}
              visibleTypes={visibleTypes}
              onToggleType={toggleType}
              clientId={clientId}
              clients={clients}
              onClientChange={setClientId}
              status={status}
              statuses={statuses}
              onStatusChange={setStatus}
            />
          </div>
        </details>

        <aside className="hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/10 lg:block">
          <CalendarFilters
            selectedScope={selectedScope}
            allowedScopeOptions={allowedScopeOptions}
            onScopeChange={setScopeOverride}
            campaignId={campaignId}
            campaigns={campaigns}
            onCampaignChange={setCampaignId}
            range={range}
            onRangeChange={setRange}
            visibleTypes={visibleTypes}
            onToggleType={toggleType}
            clientId={clientId}
            clients={clients}
            onClientChange={setClientId}
            status={status}
            statuses={statuses}
            onStatusChange={setStatus}
          />
        </aside>

        <main className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
            <Metric label="Events" value={calendar?.summary.total || 0} />
            <Metric label="Assigned to me" value={calendar?.summary.assignedToMe || 0} />
            <Metric label="Publishing" value={calendar?.summary.publishing || 0} />
            <Metric label="Overdue" value={calendar?.summary.overdue || 0} tone="danger" />
          </div>

          <section className="order-3 hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/10 sm:block lg:order-2 lg:p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Calendar View</h2>
                <p className="mt-1 text-sm text-zinc-500">Week, day, month, and year views use the same role-aware events.</p>
              </div>
              <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
                {scopeLabel(selectedScope)}
              </span>
            </div>
            <div className="h-[560px] overflow-hidden rounded-lg border border-zinc-800 bg-background lg:h-[720px]">
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

          <section className="order-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/10 sm:order-3 lg:rounded-xl lg:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Agenda</h2>
                <p className="mt-1 text-sm text-zinc-500">{scopeLabel(selectedScope)} · {formatDate(range.from)} to {formatDate(range.to)}</p>
              </div>
            </div>

            <div className="mt-3">
              {isLoading ? (
                <div className="rounded-md border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Loading calendar...</div>
              ) : error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
              ) : groupedEvents.length ? (
                <div className="space-y-4">
                  {groupedEvents.map((group) => (
                    <div key={group.date}>
                      <div className="sticky top-14 z-10 bg-background/90 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur lg:top-[72px]">
                        {formatDate(group.date)}
                      </div>
                      <div className="space-y-2">
                        {group.events.map((event) => (
                          <CalendarEventCard key={event.id} event={event} onOpen={() => openCalendarEvent(event)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No events in this view.</div>
              )}
            </div>
          </section>
        </main>
      </div>

      {isFilterOpen ? (
        <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label="Calendar filters">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close filters" onClick={() => setIsFilterOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
              <h2 className="text-base font-semibold text-white">Calendar filters</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" className="grid h-11 w-11 place-items-center rounded-md text-zinc-300"><X size={20} /></button>
            </div>
            <div className="p-4">
              <CalendarFilters
                selectedScope={selectedScope}
                allowedScopeOptions={allowedScopeOptions}
                onScopeChange={setScopeOverride}
                campaignId={campaignId}
                campaigns={campaigns}
                onCampaignChange={setCampaignId}
                range={range}
                onRangeChange={setRange}
                visibleTypes={visibleTypes}
                onToggleType={toggleType}
                clientId={clientId}
                clients={clients}
                onClientChange={setClientId}
                status={status}
                statuses={statuses}
                onStatusChange={setStatus}
              />
            </div>
            <div className="sticky bottom-0 flex gap-2 border-t border-zinc-800 bg-zinc-950 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button type="button" onClick={resetDefaults} className="min-h-11 flex-1 rounded-md border border-zinc-700 text-sm font-semibold text-zinc-200">Reset</button>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="min-h-11 flex-1 rounded-md bg-indigo-500 text-sm font-semibold text-white">Apply</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarFilters({
  selectedScope,
  allowedScopeOptions,
  onScopeChange,
  campaignId,
  campaigns,
  onCampaignChange,
  range,
  onRangeChange,
  visibleTypes,
  onToggleType,
  clientId,
  clients,
  onClientChange,
  status,
  statuses,
  onStatusChange,
}: {
  selectedScope: CalendarScope;
  allowedScopeOptions: Array<{ value: CalendarScope; label: string }>;
  onScopeChange: (scope: CalendarScope | "") => void;
  campaignId: string;
  campaigns: Campaign[];
  onCampaignChange: (campaignId: string) => void;
  range: { from: string; to: string };
  onRangeChange: Dispatch<SetStateAction<{ from: string; to: string }>>;
  visibleTypes: string[];
  onToggleType: (type: string) => void;
  clientId: string;
  clients: Array<{ id: string; name: string }>;
  onClientChange: (clientId: string) => void;
  status: string;
  statuses: string[];
  onStatusChange: (status: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Scope</label>
        <select
          value={selectedScope}
          onChange={(event) => onScopeChange(event.target.value as CalendarScope)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none focus:border-indigo-500 lg:text-sm"
        >
          {allowedScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Campaign</label>
        <select
          value={campaignId}
          onChange={(event) => onCampaignChange(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none focus:border-indigo-500 lg:text-sm"
        >
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Client</label>
        <select value={clientId} onChange={(event) => onClientChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none focus:border-indigo-500 lg:text-sm">
          <option value="">All clients</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</label>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none focus:border-indigo-500 lg:text-sm">
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Date Range</label>
        <input
          type="date"
          value={range.from.slice(0, 10)}
          onChange={(event) => onRangeChange((current) => ({ ...current, from: new Date(event.target.value).toISOString() }))}
          className="date-input min-h-11 rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none focus:border-indigo-500 lg:text-sm"
        />
        <input
          type="date"
          value={range.to.slice(0, 10)}
          onChange={(event) => onRangeChange((current) => ({ ...current, to: endOfDay(event.target.value).toISOString() }))}
          className="date-input min-h-11 rounded-md border border-zinc-800 bg-[#0b0b11] px-3 text-base text-white outline-none focus:border-indigo-500 lg:text-sm"
        />
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Visible Calendars</div>
        <div className="mt-2 space-y-1">
          {calendarTypes.map((type) => (
            <label key={type.value} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-zinc-300 transition hover:bg-zinc-900/50">
              <input
                type="checkbox"
                checked={visibleTypes.includes(type.value)}
                onChange={() => onToggleType(type.value)}
                className="h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-indigo-500"
              />
              {type.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarEventCard({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-h-11 w-full rounded-md border border-zinc-800 bg-[#0b0b11] p-3 text-left transition hover:border-indigo-500/40 hover:bg-zinc-900 lg:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusPillClasses(event.eventType)}>{formatLabel(event.eventType)}</span>
            <span className={statusPillClasses(event.riskStatus)}>{formatLabel(event.riskStatus)}</span>
            {event.forwardedToMe ? <span className={statusPillClasses("ASSIGNED")}>Assigned to me</span> : null}
          </div>
          <h3 className="mt-2 text-base font-semibold text-white">{event.title}</h3>
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/10 lg:rounded-xl lg:p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold lg:text-3xl ${tone === "danger" ? "text-red-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function currentMonthRange() {
  return monthRange(new Date());
}

function monthRange(date: Date) {
  return {
    from: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    to: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDateInRange(date: Date, range: { from: string; to: string }) {
  const timestamp = date.getTime();
  return timestamp >= new Date(range.from).getTime() && timestamp <= new Date(range.to).getTime();
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function groupEvents(events: CalendarEvent[]) {
  const grouped = new Map<string, CalendarEvent[]>();
  [...events].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()).forEach((event) => {
    const date = event.startsAt.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) || []), event]);
  });
  return Array.from(grouped.entries()).map(([date, items]) => ({ date, events: items }));
}

function uniqueClients(events: CalendarEvent[]) {
  const clients = new Map<string, string>();
  events.forEach((event) => {
    if (event.client?.id) clients.set(event.client.id, event.client.name);
  });
  return Array.from(clients, ([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
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
