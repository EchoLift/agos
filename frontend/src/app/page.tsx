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

const workflowSteps = ["Client", "Campaign", "Reel", "Writer", "Editor", "Approval", "Published"];

const features = [
  {
    title: "Campaign planning",
    description: "Plan deliverables, deadlines, and owners in one shared workspace.",
  },
  {
    title: "Content pipeline",
    description: "Track every asset from idea to publish without chasing updates.",
  },
  {
    title: "Workflow engine",
    description: "Move work through approvals, reviews, and handoffs with clear states.",
  },
  {
    title: "Team assignments",
    description: "Know who owns each task and what is blocked in real time.",
  },
  {
    title: "Founder dashboard",
    description: "See what needs attention, what is at risk, and what is moving.",
  },
  {
    title: "Secure platform",
    description: "Google login, tenant-aware access, and role-based permissions built in.",
  },
];

const audienceTags = [
  "Short-form video agencies",
  "Content studios",
  "Creative teams",
  "Social media agencies",
  "Freelance collectives",
];

const faqItems = [
  {
    question: "Who is Agency OS for?",
    answer: "Creative teams that run client work across campaigns, content, approvals, and delivery.",
  },
  {
    question: "Is it ready for daily use?",
    answer: "The core platform is already in place, and the next step is polishing the founder experience.",
  },
  {
    question: "Do you support onboarding?",
    answer: "Yes. The product is being shaped to make setup and first-week usage feel simple and obvious.",
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
        <div className="text-lg font-semibold tracking-tight">Agency OS</div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#problem" className="transition hover:text-foreground">
            Problem
          </a>
          <a href="#workflow" className="transition hover:text-foreground">
            Workflow
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
        <section className="relative mx-auto grid max-w-7xl gap-12 overflow-hidden rounded-[3rem] border border-border bg-card px-6 py-16 shadow-2xl shadow-black/20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_50%)]" />
          <div className="relative z-20 max-w-2xl">
            <p className="mb-4 inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-300">
              Built for modern creative agencies
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Run your creative agency without WhatsApp, Notion, and Excel.
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Plan campaigns, assign reels, track production, approve work, and deliver content from one workflow built for creative teams.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#pricing"
                className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Get started
              </a>
              <a
                href="#workflow"
                className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
              >
                Watch demo
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

        <section id="problem" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 rounded-3xl border border-border bg-card p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">The problem</p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Chaos is expensive when it lives in too many places.</h2>
              <ul className="mt-8 space-y-3 text-lg text-muted-foreground">
                {problemItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="text-red-400">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">The result</p>
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

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Agency OS</p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">One operating system for client work, approvals, and delivery.</h2>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {workflowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-indigo-200">
                    {step}
                  </div>
                  {index < workflowSteps.length - 1 && <span className="text-zinc-500">↓</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-3xl border border-border bg-card p-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Workflow</p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Show one reel. Make the process obvious.</h2>
              <div className="mt-8 space-y-3">
                {workflowRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{row.label}</p>
                      <p className="text-sm text-muted-foreground">{row.status}</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-sm ${row.done ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                      {row.done ? "✓" : "⏳"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Why it matters</p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">Humans understand timelines instantly.</h3>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Instead of reading a giant task list, founders can immediately see where a project is, what is blocked, and what needs attention next.
              </p>
              <div className="mt-8 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-6">
                <p className="text-sm text-muted-foreground">Current focus</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">3 items need review</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-border bg-card p-6">
                <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 rounded-3xl border border-border bg-card p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Founder dashboard preview</p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Clarity for the person carrying the whole business.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                A founder should not have to ask, “What is urgent?” The answer should be obvious in seconds.
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
                Launching this week: 8 deliveries, 2 approvals pending, 1 blocker from client feedback.
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Built for creative agencies</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {audienceTags.map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-8 lg:p-12">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">Pricing</p>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Early access is open for founding agencies.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Join the waitlist and help shape the product as it moves from backend foundation to agency-ready workflow.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/login" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100">
                Request access
              </Link>
              <a href="#faq" className="rounded-full border border-indigo-300/30 px-5 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10">
                See FAQ
              </a>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <h2 className="text-3xl font-semibold text-foreground">Frequently asked questions</h2>
            <div className="mt-8 space-y-4">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-2xl border border-border bg-background p-5">
                  <p className="font-semibold text-foreground">{item.question}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-12 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <p>© 2026 Agency OS</p>
        <div className="flex flex-wrap gap-4">
          <a href="#" className="transition hover:text-foreground">
            Docs
          </a>
          <a href="#" className="transition hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="transition hover:text-foreground">
            Terms
          </a>
          <a href="mailto:hello@agencyos.app" className="transition hover:text-foreground">
            Contact
          </a>
          <a href="#" className="transition hover:text-foreground">
            Discord
          </a>
        </div>
      </footer>
    </div>
  );
}
