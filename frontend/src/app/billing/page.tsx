"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  createBillingOrder,
  getBillingAgencies,
  getBillingPlans,
  type BillingPeriod,
} from "@/lib/api/billing";

declare global {
  interface Window {
    Cashfree?: (options: { mode: string }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: string;
      }) => Promise<unknown>;
    };
  }
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const agencies = useQuery({
    queryKey: ["billing", "agencies"],
    queryFn: getBillingAgencies,
  });
  const plans = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: getBillingPlans,
  });
  const [agencyId, setAgencyId] = useState(
    () => searchParams.get("agencyId") ?? "",
  );
  const [period, setPeriod] = useState<BillingPeriod | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  const selected = agencies.data?.find((item) => item.agency.id === agencyId);
  const renewalAvailableAt = selected?.renewalAvailableAt
    ? new Date(selected.renewalAvailableAt)
    : null;
  const renewalLocked = Boolean(
    renewalAvailableAt && renewalAvailableAt > new Date(),
  );

  async function pay() {
    if (!selected || !period || renewalLocked) return;
    setBusy(true);
    try {
      const order = await createBillingOrder(agencyId, period);
      await window
        .Cashfree?.({ mode: order.environment })
        .checkout({
          paymentSessionId: order.paymentSessionId,
          redirectTarget: "_self",
        });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] p-6 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold">Billing & Plans</h1>
        <p className="mt-2 text-zinc-400">
          Choose the agency you want to activate or extend.
        </p>
        <select
          className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
          value={agencyId}
          onChange={(event) => {
            setAgencyId(event.target.value);
            setPeriod(null);
          }}
        >
          <option value="">Select an agency</option>
          {agencies.data?.map((item) => (
            <option key={item.agency.id} value={item.agency.id}>
              {item.agency.name} ({item.role})
            </option>
          ))}
        </select>
        {selected && (
          <>
            <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5">
              <strong>Agency being activated: {selected.agency.name}</strong>
              <p className="mt-1 text-sm text-zinc-300">
                This payment will extend {selected.agency.name} only. It will
                not affect your other AGENCIE workspaces.
              </p>
              <p className="mt-2 text-sm">
                Current status: {selected.subscription?.status ?? "None"} ·
                Active team: {selected.activeMembers}
              </p>
              {renewalLocked && renewalAvailableAt ? (
                <p className="mt-2 text-sm text-amber-300">
                  Renewal becomes available on{" "}
                  {renewalAvailableAt.toLocaleDateString()}.
                </p>
              ) : null}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {plans.data?.map((plan) => (
                <button
                  key={plan.period}
                  disabled={renewalLocked}
                  onClick={() => setPeriod(plan.period)}
                  className={`rounded-2xl border p-5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${period === plan.period ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-800 bg-zinc-950"}`}
                >
                  <strong>{plan.months} Months</strong>
                  <p className="mt-2 text-2xl">
                    ₹{(plan.amountMinor / 100).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {plan.teamLimit
                      ? `Up to ${plan.teamLimit} team members`
                      : "Unlimited team members"}
                    <br />
                    All features
                  </p>
                </button>
              ))}
            </div>
            <button
              disabled={!period || busy || renewalLocked}
              onClick={pay}
              className="mt-6 rounded-xl bg-indigo-500 px-6 py-3 font-semibold disabled:opacity-50"
            >
              {busy ? "Creating secure order…" : "Review and Pay"}
            </button>
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Payment history</h2>
              {selected.paymentHistory.length ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
                  {selected.paymentHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-wrap justify-between gap-2 border-b border-zinc-800 p-4 last:border-b-0"
                    >
                      <span>{payment.period.replaceAll("_", " ")}</span>
                      <span>₹{(payment.amountMinor / 100).toLocaleString("en-IN")}</span>
                      <span className="text-zinc-400">{payment.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">No payments yet.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
