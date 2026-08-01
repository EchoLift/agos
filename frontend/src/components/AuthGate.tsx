"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasToken = Boolean(getAccessToken());

      if (hasToken) {
        setAuthState("allowed");
        return;
      }

      setAuthState("denied");
      router.replace("/login");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  if (authState !== "allowed") {
    return null;
  }

  return <>{children}</>;
}
