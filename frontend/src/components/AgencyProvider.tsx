"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getMyMemberships, Agency } from "@/lib/api/organization";

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
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getMyMemberships()
      .then((data) => {
        if (!isMounted) return;
        const matched = data.agencies.find((a) => a.slug === slug);
        if (matched) {
          setAgency(matched);
        } else {
          setError("Agency not found or you don't have access.");
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load agency.",
        );

        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-zinc-500">Loading workspace…</div>
      </div>
    );
  }

  if (error || !agency) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b]">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-red-400">
          {error || "Workspace not found"}
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
