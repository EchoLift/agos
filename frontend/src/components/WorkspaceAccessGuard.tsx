"use client";

import { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { getProfile, Profile } from "@/lib/api/me";
import { canAccessWorkspacePath } from "@/lib/workspace-access";

export default function WorkspaceAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { agency, agencySlug } = useAgency();
  const [profile, setProfile] = useState<Profile | null>(null);
  const slug = agencySlug || "";

  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then((data) => {
        if (isMounted) setProfile(data);
      })
      .catch(() => {
        if (isMounted) setProfile(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!slug || canAccessWorkspacePath(pathname, agency, slug, profile?.id)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 text-center shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Access limited</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">This view is not part of your workspace.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          AGENCIE keeps each role focused. You can still use the pages that match your current responsibilities.
        </p>
        <Link
          href={`/${slug}`}
          className="mt-6 inline-flex rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
