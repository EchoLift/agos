import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refunds & Cancellations — AGENCIE",
  description: "AGENCIE refund and cancellation policy.",
};

export default function RefundsAndCancellationsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/40 bg-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <Link
            href="/"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            ← Back to AGENCIE
          </Link>
          <h1 className="mt-8 text-4xl font-bold tracking-tight">
            Refunds &amp; Cancellations
          </h1>
          <p className="mt-4 text-muted-foreground">
            Effective date: September 5, 2026
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-12 text-sm leading-7 text-muted-foreground">
        <PolicySection title="One-time billing periods">
          AGENCIE access is purchased as a one-time 3-month, 6-month, or
          12-month billing period. We do not automatically renew the purchase or
          debit your payment method. You may choose to purchase another period
          when renewal becomes available.
        </PolicySection>
        <PolicySection title="Cancelling checkout">
          You may cancel before completing payment. A cancelled or failed
          checkout does not activate or extend agency access, and no agency data
          is deleted.
        </PolicySection>
        <PolicySection title="Refund requests">
          If you were charged incorrectly, experienced a duplicate charge, or
          could not access the purchased service because of an AGENCIE technical
          issue, contact us within 7 days of payment. Eligible refunds are
          reviewed individually and returned to the original payment method.
          Processing times may depend on the payment provider and your bank.
        </PolicySection>
        <PolicySection title="Non-refundable situations">
          Except where required by applicable law, completed billing periods are
          not refundable for change of mind, unused time, reduced usage, or
          failure to cancel a checkout before payment. Suspending or cancelling
          an agency entitlement for a violation of our Terms does not create an
          automatic right to a refund.
        </PolicySection>
        <PolicySection title="Contact">
          To request assistance, email{" "}
          <a
            href="mailto:echoliftagency@gmail.com"
            className="font-medium text-indigo-400 underline"
          >
            echoliftagency@gmail.com
          </a>{" "}
          with your agency name, payment date, amount, and payment order
          reference. Do not send card numbers, OTPs, or banking credentials.
        </PolicySection>
      </div>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  );
}
