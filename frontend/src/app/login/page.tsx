"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { exchangeGoogleToken, getAccessToken, clearAccessToken } from "@/lib/auth";
import {
  renderGoogleButton,
  getDevFallbackToken,
  isDevFallbackEnabled,
} from "@/lib/google-auth";
import { getMyMemberships } from "@/lib/api/organization";
import { getWorkspaceUrl } from "@/lib/workspace-url";

const getCurrentAgency = (memberships: { currentAgency: { slug: string } | null; agencies: Array<{ slug: string }> }) => {
  return memberships.currentAgency ?? memberships.agencies[0] ?? null;
};

export default function LoginPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleButtonMountedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  const handleCredential = useCallback(
    async (idToken: string) => {
      setLoading(true);
      setError(null);

      try {
        await exchangeGoogleToken(idToken);
        const memberships = await getMyMemberships();
        const currentAgency = getCurrentAgency(memberships);
        if (currentAgency) {
          window.location.href = getWorkspaceUrl(currentAgency.slug);
        } else {
          router.push("/create-agency");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to complete Google sign in."
        );
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  // Redirect if already authenticated
  useEffect(() => {
    const existingToken = getAccessToken();
    if (!existingToken) return; // not logged in — stay on login page

    getMyMemberships()
      .then((memberships) => {
        const currentAgency = getCurrentAgency(memberships);
        if (currentAgency) {
          window.location.href = getWorkspaceUrl(currentAgency.slug);
        } else {
          router.push("/create-agency");
        }
      })
      .catch(() => {
        // Token was invalid/revoked — clear it and stay on login page
        clearAccessToken();
      });
  }, [router]);

  // Mount the Google Sign-In button
  useEffect(() => {
    const container = googleButtonRef.current;
    if (!container || googleButtonMountedRef.current) return;

    if (isDevFallbackEnabled(clientId)) {
      googleButtonMountedRef.current = true;
      return;
    }

    // Wait for GIS script to load (may take a moment)
    const tryMount = () => {
      if (!window.google?.accounts?.id) return false;

      renderGoogleButton(container, clientId).then(handleCredential).catch((err) => {
        setError(
          err instanceof Error ? err.message : "Google sign-in failed."
        );
      });

      googleButtonMountedRef.current = true;
      return true;
    };

    if (tryMount()) return;

    // Poll briefly if the script hasn't loaded yet
    const interval = setInterval(() => {
      if (tryMount()) clearInterval(interval);
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!googleButtonMountedRef.current) {
        setError("Google Identity Services failed to load. Check your network or try refreshing.");
      }
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [clientId, handleCredential]);

  const handleDevLogin = async () => {
    const devToken = getDevFallbackToken();
    await handleCredential(devToken);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-24">
        <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/80 p-10 shadow-2xl shadow-black/30">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Continue with Google
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-white">
              Sign in to AGENCIE
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
              One click and we&apos;ll take you straight to agency setup. No
              forms, no passwords.
            </p>
          </div>

          {/* Google renders its own button here */}
          <div
            ref={googleButtonRef}
            className="flex min-h-[44px] w-full items-center justify-center"
          />

          {/* Dev fallback button */}
          {isDevFallbackEnabled(clientId) && (
            <button
              onClick={handleDevLogin}
              disabled={loading}
              className="mt-4 w-full rounded-full bg-zinc-800 px-6 py-4 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in…" : "Dev Login (no Google)"}
            </button>
          )}

          {loading && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              Signing in…
            </p>
          )}

          {error ? (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          ) : null}

          <p className="mt-6 text-center text-sm text-zinc-500">
            This flow exchanges a Google ID token with the backend session
            endpoint.
          </p>
        </div>
      </main>
    </div>
  );
}
