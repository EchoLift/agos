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
          <main className="w-full px-2 py-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-3 md:px-4 lg:px-5 lg:pb-4">
            <WorkspaceAccessGuard>{children}</WorkspaceAccessGuard>
          </main>
          <footer className="border-t border-zinc-800/70 bg-[#09090b]/95 py-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-center text-xs text-zinc-500 lg:pb-3">
            Powered by AGOS
          </footer>
        </div>
      </AgencyProvider>
    </AuthGate>
  );
}
