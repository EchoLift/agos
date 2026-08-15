"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { getWorkspaceHref } from "@/lib/workspace-url";

export default function NewContentPageRedirect() {
  const router = useRouter();
  const { agencySlug } = useAgency();
  const safeAgencySlug = agencySlug ?? "";

  useEffect(() => {
    if (!safeAgencySlug) return;
    router.replace(getWorkspaceHref(safeAgencySlug, "/campaigns"));
  }, [router, safeAgencySlug]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      Content is created from a campaign Content Plan. Opening Campaigns...
    </div>
  );
}
