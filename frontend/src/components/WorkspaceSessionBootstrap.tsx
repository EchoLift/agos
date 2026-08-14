"use client";

import { useEffect, useState } from "react";
import {
  getAccessToken,
  refreshAccessToken,
} from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export default function WorkspaceSessionBootstrap({
  children,
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
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
      const token = await refreshAccessToken();

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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-indigo-400" />
        <p className="text-sm text-zinc-400">
          Loading workspace…
        </p>
      </div>
    </div>
  );
}

  return <>{children}</>;
}