import type { Metadata } from "next";
import type { ReactNode } from "react";
import AuthGate from "@/components/AuthGate";
import AgencyProvider from "@/components/AgencyProvider";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import WorkspaceAccessGuard from "@/components/WorkspaceAccessGuard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}): Promise<Metadata> {
  const { agencySlug } = await params;
  return {
    title: `Dashboard • ${agencySlug}`,
    description: `Workspace for ${agencySlug}.`,
  };
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;

  return (
    <AuthGate>
      <AgencyProvider slug={agencySlug}>
        <div className="agos-workspace min-h-screen bg-[#09090b] text-zinc-100">
          <WorkspaceHeader agencySlug={agencySlug} />
          <main className="w-full px-3 py-4 pl-24 pr-3 md:px-4 lg:px-5">
            <WorkspaceAccessGuard>{children}</WorkspaceAccessGuard>
          </main>
          <footer className="border-t border-zinc-800/70 bg-[#09090b]/95 py-3 pl-20 text-center text-xs text-zinc-500 md:pl-0">
            Powered by AGOS
          </footer>
        </div>
      </AgencyProvider>
    </AuthGate>
  );
}
