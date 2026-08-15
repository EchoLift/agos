"use client";

import { useEffect, useMemo, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, List } from "lucide-react";
import { CalendarEvent } from "@/lib/api/calendar";
import { formatLabel, statusPillClasses } from "@/lib/status-style";

export type MobileRepresentation = "calendar" | "agenda";
export type MobileCalendarMode = "day" | "three-day" | "week" | "month";

const HOUR_HEIGHT = 56;

export function MobileCalendarExperience({
  events,
  summary,
  selectedDate,
  representation,
  mode,
  isLoading,
  error,
  onDateChange,
  onRepresentationChange,
  onModeChange,
  onOpenFilters,
  onOpenEvent,
}: {
  events: CalendarEvent[];
  summary: { total: number; publishing: number; overdue: number };
  selectedDate: Date;
  representation: MobileRepresentation;
  mode: MobileCalendarMode;
  isLoading: boolean;
  error: string | null;
  onDateChange: (date: Date) => void;
  onRepresentationChange: (value: MobileRepresentation) => void;
  onModeChange: (value: MobileCalendarMode) => void;
  onOpenFilters: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const step = mode === "three-day" ? 3 : mode === "week" ? 7 : 1;
  const navigate = (direction: -1 | 1) => {
    const next = new Date(selectedDate);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * step);
    onDateChange(next);
  };

  return (
    <section className="min-w-0 lg:hidden">
      <div className="sticky top-14 z-30 border-b border-border bg-background/95 px-1 pb-2 pt-1 backdrop-blur">
        <div className="flex min-h-11 items-center gap-1">
          <button type="button" onClick={() => navigate(-1)} aria-label="Previous date" className="grid h-11 w-11 place-items-center rounded-md border border-border text-foreground">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => navigate(1)} aria-label="Next date" className="grid h-11 w-11 place-items-center rounded-md border border-border text-foreground">
            <ChevronRight size={20} />
          </button>
          <button type="button" onClick={() => onDateChange(new Date())} className="min-h-11 rounded-md border border-border px-3 text-sm font-semibold text-foreground">Today</button>
          <div className="min-w-0 flex-1 px-2 text-right text-sm font-semibold text-foreground">{monthTitle(selectedDate)}</div>
          <button type="button" onClick={onOpenFilters} aria-label="Calendar filters" className="grid h-11 w-11 place-items-center rounded-md border border-border text-foreground">
            <Filter size={18} />
          </button>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex rounded-md bg-muted p-1">
            <ToggleButton active={representation === "calendar"} label="Calendar" icon={<CalendarDays size={16} />} onClick={() => onRepresentationChange("calendar")} />
            <ToggleButton active={representation === "agenda"} label="Agenda" icon={<List size={16} />} onClick={() => onRepresentationChange("agenda")} />
          </div>
          {representation === "calendar" ? (
            <select value={mode} onChange={(event) => onModeChange(event.target.value as MobileCalendarMode)} aria-label="Calendar mode" className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold text-card-foreground">
              <option value="day">Day</option>
              <option value="three-day">3 Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          ) : null}
        </div>
        <div className="mt-2 truncate text-xs text-muted-foreground">{summary.total} events · {summary.overdue} overdue · {summary.publishing} publishing</div>
      </div>

      {isLoading ? <StateMessage>Loading calendar...</StateMessage> : error ? <StateMessage danger>{error}</StateMessage> : representation === "agenda" ? (
        <MobileAgenda events={events} onOpenEvent={onOpenEvent} />
      ) : mode === "month" ? (
        <MonthCalendar events={events} selectedDate={selectedDate} onDateChange={onDateChange} onOpenEvent={onOpenEvent} />
      ) : (
        <TimeCalendar events={events} selectedDate={selectedDate} mode={mode} onDateChange={onDateChange} onOpenEvent={onOpenEvent} />
      )}
    </section>
  );
}

function ToggleButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-9 items-center gap-1.5 rounded px-2.5 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{icon}{label}</button>;
}

function TimeCalendar({ events, selectedDate, mode, onDateChange, onOpenEvent }: { events: CalendarEvent[]; selectedDate: Date; mode: Exclude<MobileCalendarMode, "month">; onDateChange: (date: Date) => void; onOpenEvent: (event: CalendarEvent) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => visibleDays(selectedDate, mode), [selectedDate, mode]);
  const stripDays = useMemo(() => mode === "day" ? visibleDays(selectedDate, "week") : days, [days, mode, selectedDate]);
  const eventsByDay = useMemo(() => eventsByDate(events), [events]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 9 * HOUR_HEIGHT;
    });
  }, [mode, selectedDate]);

  return (
    <div className="mt-2 min-w-0 overflow-hidden border-y border-border bg-card">
      <DateStrip days={stripDays} eventsByDay={eventsByDay} selectedDate={selectedDate} onDateChange={onDateChange} />
      <div className="border-b border-border bg-muted/40 py-2 pl-14 pr-3 text-sm font-semibold text-foreground">
        {selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
      </div>
      <div ref={scrollRef} className="h-[calc(100dvh-265px)] min-h-[420px] overflow-auto overscroll-contain">
        <div className={`relative ${mode === "three-day" ? "min-w-[660px]" : mode === "week" ? "min-w-[1120px]" : "min-w-full"}`} style={{ height: 24 * HOUR_HEIGHT }}>
          {Array.from({ length: 25 }, (_, hour) => (
            <div key={hour} className="absolute left-0 right-0 border-t border-border/80" style={{ top: hour * HOUR_HEIGHT }}>
              {hour < 24 ? <span className="absolute left-1 top-1 text-[11px] text-muted-foreground">{hourLabel(hour)}</span> : null}
            </div>
          ))}
          <div className="absolute bottom-0 left-12 right-0 top-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day) => <DayColumn key={dateKey(day)} events={eventsByDay.get(dateKey(day)) ?? []} onOpenEvent={onOpenEvent} />)}
          </div>
          {days.some((date) => sameDay(date, new Date())) ? <CurrentTimeLine days={days} /> : null}
        </div>
      </div>
    </div>
  );
}

function DateStrip({ days, eventsByDay, selectedDate, onDateChange }: { days: Date[]; eventsByDay: Map<string, CalendarEvent[]>; selectedDate: Date; onDateChange: (date: Date) => void }) {
  return <div className="grid border-b border-border bg-card pl-12" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>{days.map((day) => {
    const count = eventsByDay.get(dateKey(day))?.length ?? 0;
    const selected = sameDay(day, selectedDate);
    return <button key={dateKey(day)} type="button" onClick={() => onDateChange(day)} aria-pressed={selected} className={`min-h-14 border-l border-border px-1 text-center ${selected ? "bg-accent" : "bg-card"}`}>
      <span className={`block text-[10px] font-semibold uppercase ${selected ? "text-primary" : "text-muted-foreground"}`}>{day.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
      <span className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${selected ? "bg-primary text-primary-foreground" : "text-foreground"}`}>{day.getDate()}</span>
      <span className="mx-auto mt-0.5 block h-1 w-3 rounded-full bg-primary" style={{ opacity: count ? Math.min(1, 0.35 + count * 0.15) : 0 }} />
    </button>;
  })}</div>;
}

function DayColumn({ events, onOpenEvent }: { events: CalendarEvent[]; onOpenEvent: (event: CalendarEvent) => void }) {
  const positioned = useMemo(() => positionEvents(events), [events]);
  return <div className="relative min-w-0 border-l border-border/80 bg-card">{positioned.map(({ event, top, height, lane, lanes }) => (
    <button key={event.id} type="button" onClick={() => onOpenEvent(event)} className={`absolute z-10 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ${eventClasses(event)}`} style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
      <span className="block truncate font-semibold">{event.title}</span>
      <span className="block truncate opacity-80">{event.contentAsset?.displayCode || event.client?.name || formatLabel(event.eventType)}</span>
    </button>
  ))}</div>;
}

function CurrentTimeLine({ days }: { days: Date[] }) {
  const now = new Date();
  const dayIndex = days.findIndex((day) => sameDay(day, now));
  if (dayIndex < 0) return null;
  const top = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
  return <div className="pointer-events-none absolute left-12 right-0 z-20 h-px bg-red-500" style={{ top }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" /></div>;
}

function MonthCalendar({ events, selectedDate, onDateChange, onOpenEvent }: { events: CalendarEvent[]; selectedDate: Date; onDateChange: (date: Date) => void; onOpenEvent: (event: CalendarEvent) => void }) {
  const days = monthGrid(selectedDate);
  const eventsByDay = useMemo(() => eventsByDate(events), [events]);
  const selectedEvents = useMemo(
    () => [...(eventsByDay.get(dateKey(selectedDate)) ?? [])].sort(byStart),
    [eventsByDay, selectedDate],
  );
  return <div className="mt-2 border-y border-border bg-card">
    <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-semibold uppercase text-muted-foreground">{"SMTWTFS".split("").map((label, index) => <div key={`${label}-${index}`} className="py-2">{label}</div>)}</div>
    <div className="grid grid-cols-7">{days.map((day) => {
      const count = eventsByDay.get(dateKey(day))?.length ?? 0;
      const inMonth = day.getMonth() === selectedDate.getMonth();
      const selected = sameDay(day, selectedDate);
      return <button key={dateKey(day)} type="button" onClick={() => onDateChange(day)} className={`min-h-14 border-b border-r border-border p-1 text-left ${selected ? "bg-accent" : "bg-card"} ${inMonth ? "text-foreground" : "text-muted-foreground opacity-60"}`}>
        <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${selected ? "bg-primary text-primary-foreground" : ""}`}>{day.getDate()}</span>
        {count ? <span className="mt-1 block truncate text-[10px] font-medium text-primary">{count} {count === 1 ? "event" : "events"}</span> : null}
      </button>;
    })}</div>
    <div className="p-2"><h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3>{selectedEvents.length ? selectedEvents.map((event) => <DenseAgendaRow key={event.id} event={event} onOpen={() => onOpenEvent(event)} />) : <p className="py-3 text-sm text-muted-foreground">No events this day.</p>}</div>
  </div>;
}

function MobileAgenda({ events, onOpenEvent }: { events: CalendarEvent[]; onOpenEvent: (event: CalendarEvent) => void }) {
  const groups = groupByDate(events);
  return <div className="mt-2">{groups.length ? groups.map((group) => <section key={group.date} className="border-t border-border"><h2 className="sticky top-[168px] z-20 bg-background/95 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{new Date(`${group.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h2>{group.events.map((event) => <DenseAgendaRow key={event.id} event={event} onOpen={() => onOpenEvent(event)} />)}</section>) : <StateMessage>No events in this view.</StateMessage>}</div>;
}

function DenseAgendaRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="grid min-h-14 w-full grid-cols-[52px_1fr_auto] items-start gap-2 border-t border-border px-2 py-2 text-left">
    <span className="pt-0.5 text-xs font-semibold text-muted-foreground">{new Date(event.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{event.title}</span><span className="block truncate text-xs text-muted-foreground">{event.client?.name || event.campaign?.name || "Standalone gig"}</span></span>
    <span className={statusPillClasses(event.status)}>{formatLabel(event.status)}</span>
  </button>;
}

function StateMessage({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return <div className={`m-2 rounded-md border p-3 text-sm ${danger ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-dashed border-border text-muted-foreground"}`}>{children}</div>;
}

function positionEvents(events: CalendarEvent[]) {
  const sorted = [...events].sort(byStart);
  const laneEnds: number[] = [];
  const placed = sorted.map((event) => {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt || event.startsAt);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = Math.max(startMinutes + 45, end.getHours() * 60 + end.getMinutes());
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMinutes);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = endMinutes;
    return { event, lane, top: startMinutes / 60 * HOUR_HEIGHT, height: Math.max(44, (endMinutes - startMinutes) / 60 * HOUR_HEIGHT) };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((item) => ({ ...item, lanes }));
}

function visibleDays(selected: Date, mode: Exclude<MobileCalendarMode, "month">) {
  if (mode === "day") return [startOfDay(selected)];
  if (mode === "three-day") return Array.from({ length: 3 }, (_, index) => addDays(startOfDay(selected), index));
  const sunday = addDays(startOfDay(selected), -selected.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(sunday, index));
}

function monthGrid(selected: Date) {
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function groupByDate(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  [...events].sort(byStart).forEach((event) => {
    const key = dateKey(new Date(event.startsAt));
    groups.set(key, [...(groups.get(key) || []), event]);
  });
  return Array.from(groups, ([date, groupEvents]) => ({ date, events: groupEvents }));
}

function eventsByDate(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const key = dateKey(new Date(event.startsAt));
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  });
  return groups;
}

function eventClasses(event: CalendarEvent) {
  if (event.riskStatus === "OVERDUE" || event.riskStatus === "BLOCKED") return "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100";
  if (event.eventType === "PUBLISHING") return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100";
  if (event.eventType === "SHOOT") return "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100";
  if (event.eventType === "REVIEW" || event.eventType === "APPROVAL") return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100";
  return "border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100";
}

function hourLabel(hour: number) { return new Date(2020, 0, 1, hour).toLocaleTimeString([], { hour: "numeric" }); }
function monthTitle(date: Date) { return date.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function sameDay(left: Date, right: Date) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
function byStart(left: CalendarEvent, right: CalendarEvent) { return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(); }
