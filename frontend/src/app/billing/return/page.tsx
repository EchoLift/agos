"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getBillingOrder } from "@/lib/api/billing";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { useMembershipsQuery } from "@/lib/query";

const CONFIRMATION_TIMEOUT_MS = 30_000;

export default function BillingReturnPage() {
  const orderId = useSearchParams().get("orderId") || "";
  const memberships = useMembershipsQuery();
  const [timedOut, setTimedOut] = useState(false);
  const orderQuery = useQuery({
    queryKey: ["billing", "order", orderId],
    queryFn: () => getBillingOrder(orderId),
    enabled: Boolean(orderId),
    refetchInterval: (query) =>
      !timedOut && query.state.data?.status === "PENDING" ? 3_000 : false,
  });

  const status = orderQuery.data?.status;

  useEffect(() => {
    if (!orderId || (status && status !== "PENDING")) return;
    const timeout = window.setTimeout(
      () => setTimedOut(true),
      CONFIRMATION_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [orderId, status]);

  const paid = status === "PAID";
  const cancelled = status === "CANCELLED";
  const failed = status === "FAILED" || orderQuery.isError;
  const unresolved = timedOut && !paid && !cancelled && !failed;
  const dashboardSlug =
    orderQuery.data?.agency.slug ?? memberships.data?.currentAgency?.slug;
  const workspaceHref = dashboardSlug
    ? getWorkspaceUrl(dashboardSlug)
    : null;

  const title = paid
    ? "Payment successful"
    : cancelled
      ? "Payment cancelled"
      : failed
        ? "Payment failed"
        : unresolved
          ? "Payment not confirmed"
          : "Checking payment status";

  const message = paid
    ? "Your agency access has been updated."
    : cancelled
      ? "You cancelled this payment. No entitlement change was made."
      : failed
        ? "The payment was not completed. No entitlement change was made."
        : unresolved
          ? "Cashfree has not confirmed a payment. If you cancelled checkout, no entitlement change was made."
          : "Confirming the payment result with Cashfree…";

  const checkAgain = async () => {
    await orderQuery.refetch();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-zinc-400">{message}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {(paid || cancelled || failed || unresolved) && (
            <>
            {unresolved && (
              <button
                type="button"
                onClick={() => void checkAgain()}
                disabled={orderQuery.isFetching}
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {orderQuery.isFetching ? "Checking…" : "Check again"}
              </button>
            )}
            <Link
              href="/billing"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              Return to Billing
            </Link>
            </>
          )}
          {workspaceHref ? (
            <Link
              href={workspaceHref}
              className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Go to dashboard
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
