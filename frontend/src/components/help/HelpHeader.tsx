"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getAccessToken } from "@/lib/auth";

const subscribeToAuth = () => () => undefined;
const getAuthSnapshot = () => Boolean(getAccessToken());
const getServerAuthSnapshot = () => false;

export default function HelpHeader() {
  const router = useRouter();
  const isAuthenticated = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <div className="flex w-full items-center justify-between px-3 py-2 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link href="/help" className="truncate rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          AGENCIE Help
        </Link>
      </div>
      {!isAuthenticated ? (
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
          Login
        </Link>
      ) : null}
    </div>
  );
}
