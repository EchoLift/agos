import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — AGENCIE",
  description:
    "Terms of Service for AGENCIE — Creative Agency Operations Platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground"
          >
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-base font-bold tracking-tight text-transparent">
              AGENCIE
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="relative mx-auto max-w-5xl px-6 py-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-muted-foreground">
            Effective date: August 12, 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section className="rounded-2xl border border-border/50 bg-card p-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
          <p>
            By accessing or using "AGENCIE", "we", "our", or "us"), an operating platform for digital marketing and creative agencies, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.
          </p>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">2. Description of Platform</h2>
          <p>
            AGENCIE provides agency management tools including client tracking, campaign planning, workflow management, content pipeline tracking, approvals, and optional integrations such as Google Calendar synchronization.
          </p>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">3. Account Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized access.
          </p>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
          <p>
            You agree not to misuse AGENCIE services, attempt unauthorized access to other agencies or workspaces, or upload malicious code or harmful data.
          </p>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">5. Third-Party Integrations</h2>
          <p>
            AGENCIE offers optional integrations with third-party services such as Google Calendar. Use of third-party features is subject to the respective third party's terms and privacy policies.
          </p>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">6. Contact Us</h2>
          <p>
            If you have any questions regarding these Terms of Service, please contact us at{" "}
            <a href="mailto:echoliftagency@gmail.com" className="text-indigo-400 underline">
              echoliftagency@gmail.com
            </a>.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between">
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-sm font-bold tracking-tight text-transparent">
            AGENCIE
          </span>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} EchoLift. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-medium text-indigo-400 hover:text-indigo-300">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
