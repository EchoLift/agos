"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  exchangeGoogleToken,
  getAccessToken,
  isAuthTemporarilyUnavailableError,
  refreshAccessToken,
} from "@/lib/auth";

import {
  getDevFallbackToken,
  isDevFallbackEnabled,
  renderGoogleButton,
} from "@/lib/google-auth";

import { getMyMemberships } from "@/lib/api/organization";
import { getWorkspaceUrl } from "@/lib/workspace-url";

type MembershipsShape = {
  currentAgency: { slug: string } | null;
  agencies: Array<{ slug: string }>;
};

const getCurrentAgency = (memberships: MembershipsShape) =>
  memberships.currentAgency ?? memberships.agencies[0] ?? null;

function getSafeReturnTo(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "agencie.in";

    const isLocal =
      url.hostname === "localhost" || url.hostname.endsWith(".localhost");

    const isAgencieDomain =
      url.hostname === rootDomain || url.hostname.endsWith(`.${rootDomain}`);

    if (!isLocal && !isAgencieDomain) {
      return null;
    }

    if (!isLocal && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleButtonMountedRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [sessionRestoreUnavailable, setSessionRestoreUnavailable] =
    useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  const redirectAfterLogin = useCallback(async () => {
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }

    const memberships = await getMyMemberships();

    const currentAgency = getCurrentAgency(memberships);

    if (currentAgency) {
      window.location.href = getWorkspaceUrl(currentAgency.slug);
      return;
    }

    router.replace("/create-agency");
  }, [returnTo, router]);

  const showRecoverableRestoreError = useCallback((message: string) => {
    setSessionRestoreUnavailable(true);
    setError(message);
  }, []);

  const handleCredential = useCallback(
    async (idToken: string) => {
      setLoading(true);
      setError(null);

      try {
        await exchangeGoogleToken(idToken);
        await redirectAfterLogin();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to complete Google sign in.",
        );
      } finally {
        setLoading(false);
      }
    },
    [redirectAfterLogin],
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      setSessionRestoreUnavailable(false);
      try {
        // First check local access token
        const existingToken = getAccessToken();

        if (existingToken) {
          try {
            await redirectAfterLogin();
            return;
          } catch (error) {
            if (isAuthTemporarilyUnavailableError(error)) {
              if (!cancelled) {
                showRecoverableRestoreError(
                  "AGENCIE is reconnecting. Your session has not been cleared.",
                );
              }
              return;
            }

            if (!cancelled && getAccessToken()) {
              showRecoverableRestoreError(
                "AGENCIE could not finish restoring your session. Your session has not been cleared.",
              );
              return;
            }
          }
        }

        try {
          const refreshResult = await refreshAccessToken();
          if (cancelled) return;

          if (refreshResult) {
            try {
              await redirectAfterLogin();
              return;
            } catch (error) {
              if (isAuthTemporarilyUnavailableError(error)) {
                showRecoverableRestoreError(
                  "AGENCIE is reconnecting. Your session has not been cleared.",
                );
                return;
              }

              if (getAccessToken()) {
                showRecoverableRestoreError(
                  "AGENCIE could not finish restoring your session. Your session has not been cleared.",
                );
                return;
              }
            }
          }
        } catch (error) {
          if (isAuthTemporarilyUnavailableError(error)) {
            if (!cancelled) {
              showRecoverableRestoreError(
                "AGENCIE is waking up. Your session has not been cleared.",
              );
            }
          }
        }
      } finally {
        if (!cancelled) {
          setRestoringSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [redirectAfterLogin, showRecoverableRestoreError]);
  useEffect(() => {
    // if (restoringSession) return;

    const container = googleButtonRef.current;

    if (!container || googleButtonMountedRef.current) {
      return;
    }

    if (isDevFallbackEnabled(clientId)) {
      googleButtonMountedRef.current = true;
      return;
    }

    const tryMount = () => {
      if (!window.google?.accounts?.id) {
        return false;
      }

      renderGoogleButton(container, clientId)
        .then(handleCredential)
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Google sign-in failed.",
          );
        });

      googleButtonMountedRef.current = true;
      return true;
    };

    if (tryMount()) {
      return;
    }

    const interval = window.setInterval(() => {
      if (tryMount()) {
        window.clearInterval(interval);
      }
    }, 200);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);

      if (!googleButtonMountedRef.current) {
        setError(
          "Google Identity Services failed to load. Check your network or try refreshing.",
        );
      }
    }, 8000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [clientId, handleCredential]);

  const handleDevLogin = async () => {
    const devToken = getDevFallbackToken();
    await handleCredential(devToken);
  };

  const handleSessionRetry = () => {
    setRestoringSession(true);
    setSessionRestoreUnavailable(false);
    setError(null);
    window.location.reload();
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
              One click and we&apos;ll take you straight to your workspace. No
              forms, no passwords.
            </p>
          </div>

          <div
            ref={googleButtonRef}
            className="flex min-h-[44px] w-full items-center justify-center"
          />

          {isDevFallbackEnabled(clientId) && (
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={loading}
              className="mt-4 w-full rounded-full bg-zinc-800 px-6 py-4 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in…" : "Dev Login (no Google)"}
            </button>
          )}

          {restoringSession && (
            <p className="mt-4 text-center text-xs text-zinc-500">
              Checking existing session…
            </p>
          )}

          {sessionRestoreUnavailable ? (
            <button
              type="button"
              onClick={handleSessionRetry}
              className="mt-4 w-full rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-white"
            >
              Retry session restore
            </button>
          ) : null}

          {loading && !restoringSession && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              Signing in…
            </p>
          )}
          {error ? (
            <p className="mt-4 break-words text-sm text-red-400">{error}</p>
          ) : null}
          <p className="mt-6 text-center text-sm text-zinc-500">
            Secure authentication via Google and the AGENCIE backend session.
          </p>
        </div>
      </main>
    </div>
  );
}
