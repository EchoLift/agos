"use client";

import React from "react";

export interface AgencieLoaderProps {
  label?: string;
  sublabel?: string;
  variant?: "fullscreen" | "overlay" | "inline" | "compact";
  size?: "sm" | "md" | "lg";
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function AgencieLogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dimensions =
    size === "sm"
      ? "h-8 w-8"
      : size === "lg"
      ? "h-16 w-16"
      : "h-12 w-12";

  return (
    <div className={`relative flex items-center justify-center ${dimensions}`} aria-hidden="true">
      {/* Outer ambient glow */}
      <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl animate-pulse" />

      {/* Rotating gradient ring */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500/30 via-violet-500/20 to-transparent animate-spin [animation-duration:4s]" />

      {/* Inner branded icon container */}
      <div className="relative flex h-full w-full items-center justify-center rounded-2xl border border-indigo-500/30 bg-zinc-950/90 shadow-xl shadow-indigo-950/30 backdrop-blur-sm">
        {/* Geometric AGENCIE node icon */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-3/5 w-3/5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
        >
          <circle cx="16" cy="8" r="3.5" fill="currentColor" fillOpacity="0.9" />
          <circle cx="8" cy="22" r="3.5" fill="currentColor" fillOpacity="0.8" />
          <circle cx="24" cy="22" r="3.5" fill="currentColor" fillOpacity="0.8" />
          <path
            d="M16 8L8 22M16 8L24 22M8 22H24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.6"
          />
          <circle cx="16" cy="16" r="2" fill="#c4b5fd" />
        </svg>
      </div>
    </div>
  );
}

export function AgencieLoader({
  label = "Loading AGENCIE…",
  sublabel,
  variant = "fullscreen",
  size = "md",
  action,
  className = "",
}: AgencieLoaderProps) {
  const isFullscreen = variant === "fullscreen";
  const isOverlay = variant === "overlay";
  const isCompact = variant === "compact";

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-zinc-100"
    : isOverlay
    ? "fixed inset-0 z-[100] flex items-center justify-center bg-[#09090b]/90 px-4 backdrop-blur-sm text-zinc-100"
    : isCompact
    ? "flex items-center gap-3 py-3"
    : "flex min-h-[280px] w-full flex-col items-center justify-center py-12 px-4 text-zinc-100";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`${containerClasses} ${className}`}
    >
      {isCompact ? (
        <div className="flex items-center gap-3">
          <AgencieLogoMark size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-300">{label}</p>
            {sublabel && <p className="text-[11px] text-zinc-500">{sublabel}</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <AgencieLogoMark size={size} />

          <div className="mt-4">
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-400 bg-clip-text text-xs font-bold uppercase tracking-[0.25em] text-transparent">
              AGENCIE
            </span>
            <h4 className="mt-1 text-sm font-medium text-zinc-200">{label}</h4>
            {sublabel && (
              <p className="mt-1 max-w-xs text-xs text-zinc-500">{sublabel}</p>
            )}
          </div>

          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-5 rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-xs font-medium text-zinc-200 shadow-sm transition hover:border-indigo-400 hover:bg-zinc-800 hover:text-white"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
