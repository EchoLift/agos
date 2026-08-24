"use client";

import { useEffect, useState } from "react";
import {
  getAccessToken,
  getCentralLoginUrl,
  isAuthTemporarilyUnavailableError,
  refreshAccessToken,
} from "@/lib/auth";
import { AgencieLoader } from "@/components/ui/AgencieLoader";

type Props = {
  children: React.ReactNode;
};

export default function WorkspaceSessionBootstrap({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [temporarilyUnavailable, setTemporarilyUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setTemporarilyUnavailable(false);

      // Every subdomain has its own localStorage.
      // If this workspace already has an access token,
      // no refresh is necessary.
      if (getAccessToken()) {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      // Ask the API host to restore the session using
      // its HttpOnly refresh cookie.
      let token: string | null = null;
      try {
        token = await refreshAccessToken();
      } catch (error) {
        if (cancelled) return;

        if (isAuthTemporarilyUnavailableError(error)) {
          setTemporarilyUnavailable(true);
          return;
        }

        throw error;
      }

      if (cancelled) return;

      if (token) {
        setReady(true);
        return;
      }

      // No valid backend session.
      // Send the user to the central login page.
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      window.location.replace(getCentralLoginUrl(returnTo));
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <AgencieLoader
        variant="fullscreen"
        label={
          temporarilyUnavailable
            ? "Reconnecting to AGENCIE…"
            : "Loading workspace…"
        }
        sublabel={
          temporarilyUnavailable
            ? "Your session is being restored. Please hold on."
            : "Preparing your workspace and active sessions…"
        }
        action={
          temporarilyUnavailable
            ? {
                label: "Retry connection",
                onClick: () => window.location.reload(),
              }
            : undefined
        }
      />
    );
  }

  return <>{children}</>;
}
