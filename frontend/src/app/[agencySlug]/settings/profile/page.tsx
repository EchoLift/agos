"use client";

import { useEffect, useState } from "react";
import { useAgency } from "@/components/AgencyProvider";
import { getProfile, Profile, updateProfile } from "@/lib/api/me";

export default function ProfileSettingsPage() {
  const { agencySlug } = useAgency();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState({ name: "", avatarUrl: "", mobileNumber: "", timezone: "Asia/Kolkata", language: "en", jobTitle: "", bio: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((data) => {
      setProfile(data);
      setDraft({
        name: data.name || "",
        avatarUrl: data.avatarUrl || "",
        mobileNumber: data.mobileNumber || "",
        timezone: data.timezone || "Asia/Kolkata",
        language: data.language || "en",
        jobTitle: data.jobTitle || "",
        bio: data.bio || "",
      });
    }).catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load profile."));
  }, []);

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile({
        name: draft.name,
        avatarUrl: draft.avatarUrl || null,
        mobileNumber: draft.mobileNumber || null,
        timezone: draft.timezone || null,
        language: draft.language || null,
        jobTitle: draft.jobTitle || null,
        bio: draft.bio || null,
      });
      setProfile(updated);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">My Profile</h1>
        <p className="mt-2 text-sm text-zinc-400">Your identity across {agencySlug}. Email is managed by your sign-in provider.</p>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="space-y-5">
          <ReadOnly label="Email" value={profile?.email || "Loading..."} />
          <Field label="Display Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <Field label="Avatar URL" value={draft.avatarUrl} onChange={(value) => setDraft((current) => ({ ...current, avatarUrl: value }))} />
          <Field label="Mobile Number" value={draft.mobileNumber} onChange={(value) => setDraft((current) => ({ ...current, mobileNumber: value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone" value={draft.timezone} onChange={(value) => setDraft((current) => ({ ...current, timezone: value }))} />
            <Field label="Language" value={draft.language} onChange={(value) => setDraft((current) => ({ ...current, language: value }))} />
          </div>
          <Field label="Job Title" value={draft.jobTitle} onChange={(value) => setDraft((current) => ({ ...current, jobTitle: value }))} />
          <label className="block text-sm font-medium text-zinc-300">
            Short Bio
            <textarea value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} rows={4} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500" />
          </label>
          {message ? <div className="text-sm text-zinc-400">{message}</div> : null}
          <div className="flex justify-end">
            <button type="button" disabled={isSaving || !draft.name.trim()} onClick={save} className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-zinc-300">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500" /></label>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4"><div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div><div className="mt-2 text-sm text-zinc-300">{value}</div></div>;
}
