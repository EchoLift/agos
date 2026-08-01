"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { getMyMemberships } from "@/lib/api/organization";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    getMyMemberships()
      .then((memberships) => {
        const currentAgency = memberships.currentAgency ?? memberships.agencies[0] ?? null;
        if (currentAgency) {
          router.replace(`/${currentAgency.slug}`);
        }
      })
      .catch(() => {
        // Ignore failures here; unauthenticated users stay on landing page.
      });
  }, [router]);

  return null;
}
