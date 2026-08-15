"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { getContentAsset } from "@/lib/api/content";
import { getWorkspaceHref } from "@/lib/workspace-url";

export default function ContentDetailRedirectPage() {
  const router = useRouter();
  const params = useParams<{ contentId: string }>();
  const { agencyId, agencySlug } = useAgency();
  const [error, setError] = useState<string | null>(null);
  const safeAgencySlug = agencySlug ?? "";

  useEffect(() => {
    if (!agencyId || !safeAgencySlug || !params.contentId) return;
    let isMounted = true;

    getContentAsset(agencyId, params.contentId)
      .then((asset) => {
        if (!isMounted) return;
        router.replace(
          getWorkspaceHref(
            safeAgencySlug,
            `/campaigns/${asset.campaignId}?tab=content`,
          ),
        );
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to open content.");
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId, params.contentId, router, safeAgencySlug]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      Opening this content in its campaign plan...
    </div>
  );
}
