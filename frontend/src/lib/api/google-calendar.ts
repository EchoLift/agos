import { apiClient } from "../api-client";

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string | null;
  calendarName?: string | null;
  calendarId?: string | null;
  lastSyncedAt?: string | null;
  requiresReconnect?: boolean;
  syncEnabled?: boolean;
}

export interface GoogleCalendarSyncResult {
  synced: boolean;
  created: number;
  updated: number;
  deleted: number;
}

export async function getGoogleCalendarStatus() {
  return apiClient<GoogleCalendarStatus>(
    "/integrations/google-calendar/status",
  );
}

export async function connectGoogleCalendar(agencySlug: string) {
  return apiClient<{ authorizationUrl: string }>(
    "/integrations/google-calendar/connect",
    {
      method: "POST",
      body: JSON.stringify({ agencySlug }),
    },
  );
}

export async function syncGoogleCalendar() {
  return apiClient<GoogleCalendarSyncResult>(
    "/integrations/google-calendar/sync",
    { method: "POST" },
  );
}

export async function disconnectGoogleCalendar() {
  return apiClient<{ disconnected: boolean }>(
    "/integrations/google-calendar/disconnect",
    { method: "DELETE" },
  );
}
