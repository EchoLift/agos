import Link from "next/link";
import Particles from "@/components/Particles";
import RootRedirect from "@/components/RootRedirect";

const problemItems = ["WhatsApp", "Excel", "Notion", "Google Drive", "Phone calls"];

const outcomes = [
  "Lost approvals",
  "Missed deadlines",
  "No ownership",
  "No visibility",
  "Everything depends on the founder",
];

const workflowSteps = [
  "Client",
  "Campaign",
  "Content / Deliverable",
  "Writer / Creative",
  "Shoot / Production",
  "Editor",
  "Client Approval",
  "Publishing",
];

const features = [
  {
    title: "Campaign planning",
    description:
      "Create client campaigns, define deliverables, deadlines, owners, and campaign workflows.",
  },
  {
    title: "Content pipeline",
    description:
      "Track reels, posts, carousels, videos, and other deliverables from idea to publication.",
  },
  {
    title: "Workflow engine",
    description:
      "Move work through writing, review, production, editing, approval, and delivery stages.",
  },
  {
    title: "Team assignments",
    description:
      "Assign work to writers, designers, editors, DOPs, managers, freelancers, and other collaborators.",
  },
  {
    title: "Founder dashboard",
    description:
      "See pending approvals, blocked work, upcoming deadlines, and agency workload in one place.",
  },
  {
    title: "Google Calendar",
    description:
      "Sync eligible AGOS assignments and deadlines to a connected Google Calendar.",
  },
  {
    title: "Secure platform",
    description:
      "Google authentication, agency-scoped access, and role-based permissions protect workspace data.",
  },
];

const audienceTags = [
  "Short-form video agencies",
  "Content studios",
  "Creative teams",
  "Social media agencies",
  "Freelance collectives",
];

const howItWorksSteps = [
  {
    number: "01",
    title: "Add the client",
    description: "Create the client workspace and relevant contacts.",
  },
  {
    number: "02",
    title: "Create a campaign",
    description: "Define the campaign, deliverables, timelines, and team.",
  },
  {
    number: "03",
    title: "Plan the work",
    description: "Create reels, posts, videos, shoots, or other deliverables.",
  },
  {
    number: "04",
    title: "Assign production",
    description:
      "Send work through writers, designers, DOPs, editors, managers, or freelancers.",
  },
  {
    number: "05",
    title: "Review & approve",
    description:
      "Track internal reviews, revisions, handoffs, and client approvals.",
  },
  {
    number: "06",
    title: "Deliver & publish",
    description:
      "Complete the workflow while keeping schedules and responsibilities visible.",
  },
];

const faqItems = [
  {
    question: "Who is AGOS for?",
    answer:
      "AGOS is built for creative agencies, social media agencies, content studios, production teams, freelance collectives, and other teams that manage recurring client content and approvals.",
  },
  {
    question: "Is it ready for daily use?",
    answer:
      "The core platform is already in place, and the next step is polishing the founder experience.",
  },
  {
    question: "Do you support onboarding?",
    answer:
      "Yes. The product is being shaped to make setup and first-week usage feel simple and obvious.",
  },
];

const workflowRows: Array<{ label: string; status: string; done: boolean }> = [
  { label: "REEL-021", status: "Writing", done: true },
  { label: "Manager review", status: "Review", done: false },
  { label: "Shoot", status: "Production", done: false },
  { label: "Edit", status: "Delivery", done: false },
  { label: "Approval", status: "Ready", done: false },
  { label: "Published", status: "Live", done: false },
];

export default function Home() {
  return (
    <div className="landing-page relative min-h-screen bg-background text-foreground">
      <RootRedirect />
      <Particles
        particleCount={140}
        particleSpread={10}
        speed={0.08}
        particleColors={["#818cf8", "#ffffff", "#a78bfa"]}
        moveParticlesOnHover={true}
        particleHoverFactor={1.3}
        alphaParticles={false}
        particleBaseSize={90}
        sizeRandomness={1}
        cameraDistance={20}
        disableRotation={false}
        pixelRatio={1}
        className="fixed inset-0 z-0"
      />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          AGOS
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#problem" className="transition hover:text-foreground">
            Problem
          </a>
          <a href="#how-it-works" className="transition hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="transition hover:text-foreground">
            Pricing
          </a>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative mx-auto grid max-w-7xl gap-12 overflow-hidden rounded-[3rem] border border-border bg-card px-6 py-16 shadow-2xl shadow-black/20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_50%)]" />
          <div className="relative z-20 max-w-2xl">
            <p className="mb-4 inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium uppercase tracking-widest text-indigo-300">
              Creative Agency Operations Platform
            </p>
            {/* Primary H1 Heading — explicitly AGOS for Google OAuth verification & branding */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-400 bg-clip-text text-transparent text-6xl font-extrabold sm:text-7xl lg:text-8xl mb-2">
                AGOS
              </span>
              <span className="block text-2xl font-semibold tracking-tight text-foreground sm:text-3xl mt-2">
                Run your creative agency without WhatsApp, Notion, and Excel.
              </span>
            </h1>
            <p className="mt-5 text-base font-medium leading-relaxed text-foreground/90">
              AGOS is a multi-tenant agency operating system designed for marketing and creative teams to manage work orders, deadlines, workflows, approvals, and Google Calendar event syncs.
            </p>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Plan campaigns, assign work to writers, designers, editors and
              production teams, track every deliverable through its workflow,
              and keep everyone aligned from brief to publication.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#pricing"
                className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Get started
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="relative z-20 overflow-hidden rounded-3xl border border-border bg-background/80 p-4 shadow-black/20">
            <div className="rounded-2xl border border-border bg-card p-5 backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Founder dashboard</p>
                  <p className="text-lg font-semibold text-foreground">This week at a glance</p>
                </div>
                <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">
                  12 on track
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Waiting approval</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">12</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="mt-2 text-3xl font-semibold text-orange-400">3</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Due today</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">5</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Publishing this week</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-400">8</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What AGOS does ── */}
        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                What AGOS does
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">
                One workspace for the entire creative agency workflow.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                AGOS connects clients, campaigns, content deliverables, team
                assignments, production workflows, approvals, schedules, and
                publishing so everyone knows what they need to do next.
              </p>
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                AGOS replaces fragmented agency coordination with a structured
                workflow where client work, ownership, deadlines, production
                status, reviews, and approvals stay connected.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {workflowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-indigo-200">
                    {step}
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <span className="text-zinc-500">↓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Problem ── */}
        <section id="problem" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 rounded-3xl border border-border bg-card p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                The problem
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">
                Chaos is expensive when it lives in too many places.
              </h2>
              <ul className="mt-8 space-y-3 text-lg text-muted-foreground">
                {problemItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="text-red-400">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-7 text-muted-foreground">
                AGOS replaces fragmented agency coordination with a structured
                workflow where client work, ownership, deadlines, production
                status, reviews, and approvals stay connected.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                The result
              </p>
              <ul className="mt-6 space-y-4 text-lg text-foreground">
                {outcomes.map((item) => (
                  <li key={item} className="rounded-xl border border-border bg-card px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── How AGOS works ── */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                How AGOS works
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">
                From client brief to published content.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {howItWorksSteps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <span className="font-mono text-xs font-semibold text-indigo-400">
                    {step.number}
                  </span>
                  <p className="mt-2 font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow demo ── */}
        <section id="workflow" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-3xl border border-border bg-card p-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">
                Show one reel. Make the process obvious.
              </h2>
              <div className="mt-8 space-y-3">
                {workflowRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{row.label}</p>
                      <p className="text-sm text-muted-foreground">{row.status}</p>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-sm ${
                        row.done
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.done ? "✓" : "⏳"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Why it matters
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">
                Humans understand timelines instantly.
              </h3>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Instead of reading a giant task list, founders can immediately
                see where a project is, what is blocked, and what needs
                attention next.
              </p>
              <div className="mt-8 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-6">
                <p className="text-sm text-muted-foreground">Current focus</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  3 items need review
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Features
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-border bg-card p-6">
                <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Google Calendar integration ── */}
        <section id="google-calendar" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto]">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-indigo-300">
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19.5 3h-2V1.5a.5.5 0 0 0-1 0V3h-9V1.5a.5.5 0 0 0-1 0V3h-2A2.5 2.5 0 0 0 2 5.5v15A2.5 2.5 0 0 0 4.5 23h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 3ZM21 20.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20.5V9h18v11.5ZM3 8V5.5A1.5 1.5 0 0 1 4.5 4h2v1.5a.5.5 0 0 0 1 0V4h9v1.5a.5.5 0 0 0 1 0V4h2A1.5 1.5 0 0 1 21 5.5V8H3Z" />
                  </svg>
                  Works with Google
                </div>
                <h2 className="text-3xl font-semibold text-foreground">
                  Your AGOS schedule, inside Google Calendar.
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Sign in securely with Google and connect Google Calendar to
                  keep your AGOS work schedule available wherever you work.
                </p>
                <p className="mt-3 text-base leading-7 text-muted-foreground">
                  When Google Calendar integration is enabled, AGOS can create a
                  dedicated AGOS calendar and sync eligible assigned work,
                  deadlines, shoots, reviews, and publishing schedules to it.
                  AGOS creates and manages calendar events only after you
                  explicitly connect your Google account.
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Google Calendar connection is optional and can be disconnected
                  from AGOS at any time.
                </p>
              </div>
              <div className="flex flex-col gap-4 self-center lg:w-56">
                {[
                  { label: "Assigned work", color: "bg-indigo-500/15 text-indigo-300" },
                  { label: "Shoot schedules", color: "bg-violet-500/15 text-violet-300" },
                  { label: "Review deadlines", color: "bg-sky-500/15 text-sky-300" },
                  { label: "Publishing dates", color: "bg-emerald-500/15 text-emerald-300" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl px-4 py-3 text-sm font-medium ${item.color}`}
                  >
                    {item.label}
                  </div>
                ))}
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Synced to your Google Calendar
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Founder dashboard ── */}
        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-8 rounded-3xl border border-border bg-card p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Founder dashboard preview
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">
                Clarity for the person carrying the whole business.
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                A founder should not have to ask, "What is urgent?" The answer
                should be obvious in seconds.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Waiting approval</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">12</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="mt-2 text-2xl font-semibold text-orange-400">3</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Due today</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">5</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Launching this week: 8 deliveries, 2 approvals pending, 1
                blocker from client feedback.
              </div>
            </div>
          </div>
        </section>

        {/* ── Audience ── */}
        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Built for creative agencies
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {audienceTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-8 lg:p-12">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">
                Early access is open for founding agencies.
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Join the waitlist and help shape the product as it moves from
                backend foundation to agency-ready workflow.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                Request access
              </Link>
              <a
                href="#faq"
                className="rounded-full border border-indigo-300/30 px-5 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
              >
                See FAQ
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <h2 className="text-3xl font-semibold text-foreground">
              Frequently asked questions
            </h2>
            <div className="mt-8 space-y-4">
              {faqItems.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl border border-border bg-background p-5"
                >
                  <p className="font-semibold text-foreground">{item.question}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-8 lg:p-10">
          <div className="grid gap-10 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
                AGOS
              </span>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Creative agency operations platform for campaigns, production,
                approvals, scheduling, and delivery.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Product
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="transition hover:text-foreground">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="transition hover:text-foreground">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-foreground">
                    Documentation
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Company
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="mailto:echoliftagency@gmail.com"
                    className="transition hover:text-foreground"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <Link href="/privacy" className="transition hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
            © 2026 AGOS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
