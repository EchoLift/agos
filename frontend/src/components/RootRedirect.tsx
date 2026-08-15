"use client";

import { useEffect } from "react";
import {
  getAccessToken,
  isAuthTemporarilyUnavailableError,
  refreshAccessToken,
} from "@/lib/auth";
import { getMyMemberships } from "@/lib/api/organization";
import { getWorkspaceUrl } from "@/lib/workspace-url";

export default function RootRedirect() {
  useEffect(() => {
    async function redirectToWorkspace() {
      let token = getAccessToken();

      if (!token) {
        try {
          token = await refreshAccessToken();
        } catch (error) {
          if (isAuthTemporarilyUnavailableError(error)) {
            return;
          }

          throw error;
        }
      }

      if (!token) return;

      try {
        const memberships = await getMyMemberships();

        const currentAgency =
          memberships.currentAgency ??
          memberships.agencies[0] ??
          null;

        if (currentAgency) {
          window.location.href = getWorkspaceUrl(currentAgency.slug);
        }
      } catch {
        // Leave unauthenticated users on the landing page.
      }
    }

    void redirectToWorkspace();
  }, []);

  return null;
}
