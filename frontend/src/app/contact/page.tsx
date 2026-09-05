import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us — AGENCIE",
  description: "Contact AGENCIE for product, billing, and account support.",
};

export default function ContactPage() {
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
          <h1 className="mt-8 text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Contact the AGENCIE team for product questions, account assistance,
            billing support, or payment-related concerns.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <section className="rounded-2xl border border-border/50 bg-card p-8">
          <h2 className="text-xl font-semibold">Email support</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Email us at{" "}
            <a
              href="mailto:echoliftagency@gmail.com"
              className="font-medium text-indigo-400 underline"
            >
              echoliftagency@gmail.com
            </a>
            . Please include your agency name and payment order reference when
            contacting us about a transaction.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            We aim to respond within two business days.
          </p>
        </section>
      </div>
    </main>
  );
}
