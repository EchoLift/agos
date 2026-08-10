import { apiClient } from "../api-client";

export type CalendarScope = "MY_SCHEDULE" | "MY_ROLE" | "MY_TEAM" | "CAMPAIGN" | "AGENCY";

export interface CalendarEvent {
  id: string;
  sourceId: string;
  eventType: string;
  title: string;
  startsAt: string;
  endsAt: string;
  assignedMembershipIds: string[];
  roleKeys: string[];
  campaign: { id: string; name: string } | null;
  client?: { id: string; name: string };
  contentAsset: { id: string; displayCode: string; title: string } | null;
  workOrder?: { id: string; title: string; workType: string } | null;
  visibility: string;
  status: string;
  riskStatus: string;
  platform?: string;
  owner: { membershipId: string; name: string } | null;
  forwardedToMe: boolean;
  reason: string;
}

export interface CalendarEventsResponse {
  scope: CalendarScope;
  range: { from: string; to: string };
  events: CalendarEvent[];
  summary: {
    total: number;
    assignedToMe: number;
    publishing: number;
    overdue: number;
  };
}

export interface CalendarEventFilters {
  scope?: CalendarScope;
  from?: string;
  to?: string;
  campaignId?: string;
  memberId?: string;
  eventTypes?: string[];
  statuses?: string[];
  platforms?: string[];
}

export async function getCalendarEvents(agencyId: string, filters: CalendarEventFilters = {}): Promise<CalendarEventsResponse> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length) {
      params.set(key, value.join(","));
    } else if (value) {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiClient<CalendarEventsResponse>(`/calendar/events${suffix}`, {
    method: "GET",
    agencyId,
  });
}
