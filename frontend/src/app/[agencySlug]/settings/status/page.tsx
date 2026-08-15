"use client";

import { useEffect, useState } from "react";
import { PresenceStatus, WorkLocation } from "@/lib/api/me";
import { useProfileMutations, useProfileQuery } from "@/lib/query";

const statuses: Array<{ value: PresenceStatus; label: string }> = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BUSY", label: "Busy" },
  { value: "DO_NOT_DISTURB", label: "Do Not Disturb" },
  { value: "AWAY", label: "Away" },
  { value: "OFFLINE", label: "Offline" },
];

const locations: Array<{ value: WorkLocation; label: string }> = [
  { value: "WFO", label: "WFO" },
  { value: "WFH", label: "WFH" },
  { value: "REMOTE", label: "Remote" },
];

export default function StatusSettingsPage() {
  const profileQuery = useProfileQuery();
  const { clearStatusMutation, updateStatusMutation } = useProfileMutations();
  const [status, setStatus] = useState<PresenceStatus>("AVAILABLE");
  const [location, setLocation] = useState<WorkLocation | "">("");
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    queueMicrotask(() => {
      setStatus(profile.presenceStatus || "AVAILABLE");
      setLocation(profile.workLocation || "");
      setMessage(profile.statusMessage || "");
      setExpiresAt(profile.statusExpiresAt ? profile.statusExpiresAt.slice(0, 16) : "");
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (profileQuery.error) {
      queueMicrotask(() => {
        setNotice(profileQuery.error instanceof Error ? profileQuery.error.message : "Failed to load status.");
      });
    }
  }, [profileQuery.error]);

  const save = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      await updateStatusMutation.mutateAsync({ status, location: location || null, message: message || null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
      setNotice("Status saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save status.");
    } finally {
      setIsSaving(false);
    }
  };

  const reset = async () => {
    setIsSaving(true);
    try {
      await clearStatusMutation.mutateAsync();
      setStatus("AVAILABLE");
      setLocation("");
      setMessage("");
      setExpiresAt("");
      setNotice("Status cleared.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Status</h1>
        <p className="mt-2 text-sm text-zinc-400">Manual availability for your team. No activity tracking.</p>
      </div>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
        <div className="space-y-5">
          <label className="block text-sm font-medium text-zinc-300">Status<select value={status} onChange={(event) => setStatus(event.target.value as PresenceStatus)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="block text-sm font-medium text-zinc-300">Location<select value={location} onChange={(event) => setLocation(event.target.value as WorkLocation | "")} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"><option value="">Not set</option>{locations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="block text-sm font-medium text-zinc-300">Message<input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="On a shoot until 6 PM" className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500" /></label>
          <label className="block text-sm font-medium text-zinc-300">Expires At<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="date-input mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500" /></label>
          {notice ? <div className="text-sm text-zinc-400">{notice}</div> : null}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={isSaving} onClick={reset} className="rounded-full border border-zinc-800 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-60">Clear</button>
            <button type="button" disabled={isSaving} onClick={save} className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60">{isSaving ? "Saving..." : "Save status"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
