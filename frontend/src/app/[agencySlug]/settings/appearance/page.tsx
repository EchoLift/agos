"use client";

import { useState } from "react";
import { applyThemePreference } from "@/components/ThemeController";

const themeKey = "agos_theme";
const compactKey = "agos_compact_sidebar";
const reducedMotionKey = "agos_reduced_motion";

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState(() => readStorage(themeKey, "system"));
  const [compact, setCompact] = useState(() => readStorage(compactKey, "false") === "true");
  const [reducedMotion, setReducedMotion] = useState(() => readStorage(reducedMotionKey, "false") === "true");

  const saveTheme = (value: string) => {
    setTheme(value);
    localStorage.setItem(themeKey, value);
    applyThemePreference(value);
  };

  const saveToggle = (key: string, value: boolean, setter: (value: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Appearance</h1>
        <p className="mt-2 text-sm text-zinc-400">Stored on this browser for now.</p>
      </div>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium text-zinc-300">Theme</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {["system", "light", "dark"].map((option) => (
                <button key={option} type="button" onClick={() => saveTheme(option)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition ${theme === option ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-zinc-800 text-zinc-400 hover:bg-zinc-900"}`}>{option}</button>
              ))}
            </div>
          </div>
          <Toggle label="Compact sidebar" checked={compact} onChange={(value) => saveToggle(compactKey, value, setCompact)} />
          <Toggle label="Reduced motion" checked={reducedMotion} onChange={(value) => saveToggle(reducedMotionKey, value, setReducedMotion)} />
        </div>
      </div>
    </div>
  );
}

function readStorage(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-zinc-300">{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950" /></label>;
}
