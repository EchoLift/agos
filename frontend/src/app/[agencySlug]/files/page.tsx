"use client";

import Link from "next/link";
import { useAgency } from "@/components/AgencyProvider";
import { ClientAnalyticsFilesView } from "@/components/ClientAnalyticsFilesView";
import { hasAnyRole } from "@/lib/workspace-access";
import { getWorkspaceHref } from "@/lib/workspace-url";

export default function ClientFilesPage() {
  const { agency, agencyId, agencySlug, isLoading, error } = useAgency();
  const safeAgencySlug = agencySlug ?? "";
  const isClient = hasAnyRole(agency, ["CLIENT"]);

  if (isLoading && !agency) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950/80 p-16 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="mt-4 text-sm text-zinc-400">Loading files...</p>
      </div>
    );
  }

  if (error || !agency) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-400">
        <p className="font-semibold">Unable to access workspace</p>
        <p className="mt-1 text-xs">{error || "Workspace context not found."}</p>
      </div>
    );
  }

  const clientId = agency.clientId;

  if (isClient && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 p-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">
          Client Account Unassigned
        </h3>
        <p className="mt-2 max-w-md text-xs text-zinc-400">
          Your account is not linked to a specific client profile yet. Please
          contact your agency administrator to link your account.
        </p>
      </div>
    );
  }

  if (!isClient && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950/80 p-12 text-center">
        <h3 className="text-base font-semibold text-white">
          Client Analytics Files
        </h3>
        <p className="mt-2 max-w-md text-xs text-zinc-400">
          To view and manage analytics files for a client, please select a
          client from the Clients section.
        </p>
        <Link
          href={getWorkspaceHref(safeAgencySlug, "/clients")}
          className="mt-5 inline-flex rounded-full bg-indigo-500 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
        >
          Go to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ClientAnalyticsFilesView
        agencyId={agencyId}
        clientId={clientId!}
        clientName={
          agency.client?.displayName ||
          agency.client?.name ||
          "Your Account"
        }
        canUpload={false}
        canDelete={false}
        title="Analytics Files"
        description="Reports, media and documents shared with your team."
        emptyMessage="No analytics files were shared for this reporting period."
      />
    </div>
  );
}
