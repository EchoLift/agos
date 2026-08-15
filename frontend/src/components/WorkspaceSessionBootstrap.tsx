"use client";

import { useEffect, useState } from "react";
import {
  getAccessToken,
  isAuthTemporarilyUnavailableError,
  refreshAccessToken,
} from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export default function WorkspaceSessionBootstrap({
  children,
}: Props) {
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
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        "https://app.agencie.in";

      const loginUrl = new URL("/login", appUrl);

      loginUrl.searchParams.set(
        "returnTo",
        window.location.href,
      );

      window.location.replace(loginUrl.toString());
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          {!temporarilyUnavailable ? (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-indigo-400" />
          ) : null}
          <p className="text-sm text-zinc-400">
            {temporarilyUnavailable
              ? "Reconnecting to AGENCIE…"
              : "Loading workspace…"}
          </p>
          {temporarilyUnavailable ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-indigo-400 hover:text-white"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
