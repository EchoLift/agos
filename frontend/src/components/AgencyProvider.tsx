"use client";

import { createContext, useContext, ReactNode } from "react";
import { Agency } from "@/lib/api/organization";
import { useAgencyBySlugQuery } from "@/lib/query";

interface AgencyContextType {
  agencyId: string | null;
  agencySlug: string | null;
  agencyDisplayName: string | null;
  agency: Agency | null;
  isLoading: boolean;
  error: string | null;
}

const AgencyContext = createContext<AgencyContextType>({
  agencyId: null,
  agencySlug: null,
  agencyDisplayName: null,
  agency: null,
  isLoading: true,
  error: null,
});

export const useAgency = () => useContext(AgencyContext);

export default function AgencyProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const { agency, isLoading, error } = useAgencyBySlugQuery(slug);
  const resolvedError = error
    ? error instanceof Error
      ? error.message
      : "Failed to load agency."
    : !isLoading && !agency
      ? "Agency not found or you don't have access."
      : null;

  if (isLoading && !agency) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-zinc-500">Loading workspace…</div>
      </div>
    );
  }

  if (resolvedError || !agency) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b]">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-red-400">
          {resolvedError || "Workspace not found"}
        </div>
      </div>
    );
  }

  const displayName = agency.displayName || agency.name || slug;

  return (
    <AgencyContext.Provider
      value={{
        agencyId: agency.id,
        agencySlug: agency.slug,
        agencyDisplayName: displayName,
        agency,
        isLoading: false,
        error: null,
      }}
    >
      {children}
    </AgencyContext.Provider>
  );
}
