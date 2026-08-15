"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, RefreshCw, Unplug } from "lucide-react";
import { useAgency } from "@/components/AgencyProvider";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  GoogleCalendarStatus,
  syncGoogleCalendar,
} from "@/lib/api/google-calendar";
import {
  queryKeys,
  useGoogleCalendarStatusQuery,
  useProfileMutations,
  useProfileQuery,
} from "@/lib/query";

export default function ProfileSettingsPage() {
  const { agencySlug } = useAgency();
  const queryClient = useQueryClient();
  const profileQuery = useProfileQuery();
  const { updateProfileMutation } = useProfileMutations();
  const profile = profileQuery.data ?? null;
  const calendarStatusQuery = useGoogleCalendarStatusQuery();
  const [draft, setDraft] = useState({
    name: "",
    avatarUrl: "",
    mobileNumber: "",
    timezone: "Asia/Kolkata",
    language: "en",
    jobTitle: "",
    bio: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [calendarStatus, setCalendarStatus] =
    useState<GoogleCalendarStatus | null>(null);
  const [calendarAction, setCalendarAction] = useState<
    "connect" | "sync" | "disconnect" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    queueMicrotask(() => {
      setDraft({
        name: profile.name || "",
        avatarUrl: profile.avatarUrl || "",
        mobileNumber: profile.mobileNumber || "",
        timezone: profile.timezone || "Asia/Kolkata",
        language: profile.language || "en",
        jobTitle: profile.jobTitle || "",
        bio: profile.bio || "",
      });
    });
  }, [profile]);

  useEffect(() => {
    if (!profileQuery.error) return;
    queueMicrotask(() => {
      setMessage(
        profileQuery.error instanceof Error
          ? profileQuery.error.message
          : "Failed to load profile.",
      );
    });
  }, [profileQuery.error]);

  const loadCalendarStatus = useCallback(async () => {
    try {
      setCalendarStatus(
        await queryClient.fetchQuery({
          queryKey: queryKeys.googleCalendarStatus(),
          queryFn: getGoogleCalendarStatus,
        }),
      );
    } catch (error) {
      setCalendarMessage(
        error instanceof Error
          ? error.message
          : "Failed to load Google Calendar status.",
      );
    }
  }, [queryClient]);

  useEffect(() => {
    if (calendarStatusQuery.data) {
      queueMicrotask(() => setCalendarStatus(calendarStatusQuery.data));
    }
    if (calendarStatusQuery.error) {
      queueMicrotask(() => {
        setCalendarMessage(
          calendarStatusQuery.error instanceof Error
            ? calendarStatusQuery.error.message
            : "Failed to load Google Calendar status.",
        );
      });
    }
  }, [calendarStatusQuery.data, calendarStatusQuery.error]);

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await updateProfileMutation.mutateAsync({
        name: draft.name,
        avatarUrl: draft.avatarUrl || null,
        mobileNumber: draft.mobileNumber || null,
        timezone: draft.timezone || null,
        language: draft.language || null,
        jobTitle: draft.jobTitle || null,
        bio: draft.bio || null,
      });
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const connectCalendar = async () => {
    if (!agencySlug) {
      setCalendarMessage(
        "Workspace context is required before connecting Google Calendar.",
      );
      return;
    }
    setCalendarAction("connect");
    setCalendarMessage(null);
    try {
      const { authorizationUrl } = await connectGoogleCalendar(agencySlug);
      window.location.href = authorizationUrl;
    } catch (error) {
      setCalendarMessage(
        error instanceof Error
          ? error.message
          : "Unable to start Google Calendar connection.",
      );
      setCalendarAction(null);
    }
  };

  const syncCalendar = async () => {
    setCalendarAction("sync");
    setCalendarMessage(null);
    try {
      const result = await syncGoogleCalendar();
      await loadCalendarStatus();
      setCalendarMessage(
        `Synced ${result.created + result.updated + result.deleted} change${result.created + result.updated + result.deleted === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setCalendarMessage(
        error instanceof Error
          ? error.message
          : "Unable to sync Google Calendar.",
      );
    } finally {
      setCalendarAction(null);
    }
  };

  const disconnectCalendar = async () => {
    setCalendarAction("disconnect");
    setCalendarMessage(null);
    try {
      await disconnectGoogleCalendar();
      setCalendarStatus({ connected: false });
      queryClient.setQueryData(queryKeys.googleCalendarStatus(), {
        connected: false,
      });
      setCalendarMessage("Google Calendar disconnected.");
    } catch (error) {
      setCalendarMessage(
        error instanceof Error
          ? error.message
          : "Unable to disconnect Google Calendar.",
      );
    } finally {
      setCalendarAction(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">My Profile</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your identity across {agencySlug}. Email is managed by your sign-in
          provider.
        </p>
      </div>

      <section
        id="google-calendar"
        className="scroll-mt-24 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8"
      >
        <div className="space-y-5">
          <ReadOnly label="Email" value={profile?.email || "Loading..."} />
          <Field
            label="Display Name"
            value={draft.name}
            onChange={(value) =>
              setDraft((current) => ({ ...current, name: value }))
            }
          />
          <Field
            label="Avatar URL"
            value={draft.avatarUrl}
            onChange={(value) =>
              setDraft((current) => ({ ...current, avatarUrl: value }))
            }
          />
          <Field
            label="Mobile Number"
            value={draft.mobileNumber}
            onChange={(value) =>
              setDraft((current) => ({ ...current, mobileNumber: value }))
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Timezone"
              value={draft.timezone}
              onChange={(value) =>
                setDraft((current) => ({ ...current, timezone: value }))
              }
            />
            <Field
              label="Language"
              value={draft.language}
              onChange={(value) =>
                setDraft((current) => ({ ...current, language: value }))
              }
            />
          </div>
          <Field
            label="Job Title"
            value={draft.jobTitle}
            onChange={(value) =>
              setDraft((current) => ({ ...current, jobTitle: value }))
            }
          />
          <label className="block text-sm font-medium text-zinc-300">
            Short Bio
            <textarea
              value={draft.bio}
              onChange={(event) =>
                setDraft((current) => ({ ...current, bio: event.target.value }))
              }
              rows={4}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
            />
          </label>
          {message ? (
            <div className="text-sm text-zinc-400">{message}</div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSaving || !draft.name.trim()}
              onClick={save}
              className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CalendarDays className="h-4 w-4 text-indigo-300" />
              Google Calendar
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Sync assigned AGENCIE gigs to a dedicated Google calendar.
            </p>
          </div>
          {calendarStatus?.connected ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={syncCalendar}
                disabled={calendarAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {calendarAction === "sync" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </button>
              <button
                type="button"
                onClick={disconnectCalendar}
                disabled={calendarAction !== null}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {calendarAction === "disconnect" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectCalendar}
              disabled={calendarAction !== null || !calendarStatus}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {calendarAction === "connect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
              Connect Google Calendar
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ReadOnly
            label="Status"
            value={
              calendarStatus?.connected
                ? calendarStatus.requiresReconnect
                  ? "Reconnect required"
                  : "Connected"
                : calendarStatus
                  ? "Disconnected"
                  : "Loading..."
            }
          />
          <ReadOnly
            label="Connected as"
            value={calendarStatus?.email || "Not connected"}
          />
          <ReadOnly
            label="Calendar"
            value={
              calendarStatus?.connected
                ? calendarStatus.calendarName || "AGENCIE"
                : "Not connected"
            }
          />
        </div>
        <div className="mt-3">
          <ReadOnly
            label="Last synced"
            value={
              calendarStatus?.lastSyncedAt
                ? new Date(calendarStatus.lastSyncedAt).toLocaleString()
                : "Not synced yet"
            }
          />
        </div>
        {calendarMessage ? (
          <div className="mt-4 text-sm text-zinc-400">{calendarMessage}</div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-300">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
      />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-sm text-zinc-300">{value}</div>
    </div>
  );
}
