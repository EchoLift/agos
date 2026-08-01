"use client";

import { useEffect } from "react";

const themeKey = "agos_theme";

function resolveTheme(value: string | null) {
  if (value === "light" || value === "dark") return value;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function applyThemePreference(value?: string | null) {
  if (typeof window === "undefined") return;
  const preference = value ?? localStorage.getItem(themeKey) ?? "system";
  document.documentElement.dataset.theme = resolveTheme(preference);
  document.documentElement.dataset.themePreference = preference;
}

export default function ThemeController() {
  useEffect(() => {
    applyThemePreference();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyThemePreference();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
