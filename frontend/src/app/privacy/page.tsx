import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AGOS",
  description:
    "Learn how AGOS collects, uses, stores, protects, and shares your information when you use our platform.",
};

const sections = [
  {
    id: "information-we-collect",
    number: "1",
    title: "Information We Collect",
    content: (
      <>
        <p>AGOS may collect the following categories of information.</p>

        <h3>Account Information</h3>
        <p>When you create or access an AGOS account, we may collect:</p>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>Profile image</li>
          <li>Phone number, if provided</li>
          <li>Authentication provider information</li>
          <li>Account status</li>
          <li>Profile preferences</li>
        </ul>
        <p>
          AGOS uses a universal identity model in which one verified email
          address may be associated with one AGOS user identity across multiple
          agency workspaces.
        </p>
      </>
    ),
  },
  {
    id: "agency-workspace-information",
    number: "2",
    title: "Agency and Workspace Information",
    content: (
      <>
        <p>
          When you participate in an agency workspace, AGOS may process:
        </p>
        <ul>
          <li>Agency name</li>
          <li>Agency membership</li>
          <li>Assigned roles</li>
          <li>Permissions</li>
          <li>Team relationships</li>
          <li>Job title</li>
          <li>Workspace preferences</li>
          <li>Membership status</li>
          <li>Activity within that workspace</li>
        </ul>
        <p>
          A user may belong to multiple agencies and may have different roles in
          each agency. Agency roles and permissions are scoped to the relevant
          agency and are not treated as global user roles.
        </p>
      </>
    ),
  },
  {
    id: "client-campaign-information",
    number: "3",
    title: "Client and Campaign Information",
    content: (
      <>
        <p>
          Depending on how an agency uses AGOS, we may process information
          including:
        </p>
        <ul>
          <li>Client names</li>
          <li>Client contact information</li>
          <li>Campaign details</li>
          <li>Campaign strategies</li>
          <li>Deliverable plans</li>
          <li>Publishing schedules</li>
          <li>Content information</li>
          <li>Approval requirements</li>
          <li>Client references</li>
          <li>Internal agency notes</li>
          <li>Work assignments</li>
          <li>Workflow status</li>
        </ul>
        <p>
          This information is used to provide agency operations and
          production-management functionality.
        </p>
      </>
    ),
  },
  {
    id: "work-workflow-calendar",
    number: "4",
    title: "Work, Workflow, and Calendar Information",
    content: (
      <>
        <p>AGOS may process operational information including:</p>
        <ul>
          <li>Work Orders or Gigs</li>
          <li>Workflow assignments</li>
          <li>Writing tasks</li>
          <li>Shoot schedules</li>
          <li>Editing tasks</li>
          <li>Review deadlines</li>
          <li>Submission history</li>
          <li>Approval history</li>
          <li>Blockers</li>
          <li>Revision requests</li>
          <li>Publishing dates</li>
          <li>Calendar events</li>
          <li>Work status and deadlines</li>
        </ul>
        <p>
          AGOS uses this information to help agencies coordinate production and
          to show users the work relevant to their role and permissions.
        </p>
      </>
    ),
  },
  {
    id: "google-account",
    number: "5",
    title: "Google Account Information",
    content: (
      <>
        <p>AGOS supports Sign in with Google.</p>
        <p>
          When you sign in using Google, AGOS may receive information permitted
          by the Google authentication scopes you approve, such as:
        </p>
        <ul>
          <li>Google account identifier</li>
          <li>Name</li>
          <li>Email address</li>
          <li>Profile image</li>
        </ul>
        <p>
          AGOS uses this information to authenticate your identity and associate
          your Google account with your AGOS user account. Signing in with
          Google does not automatically grant AGOS access to your Google
          Calendar.
        </p>
      </>
    ),
  },
  {
    id: "google-calendar",
    number: "6",
    title: "Google Calendar Integration",
    content: (
      <>
        <p>AGOS may offer an optional Google Calendar integration.</p>
        <p>
          Google Calendar access is requested separately from Google login and
          only after you explicitly choose to connect Google Calendar.
        </p>
        <p>
          When connected, AGOS may use Google Calendar API permissions to create
          and manage an AGOS-specific calendar and the events created by AGOS
          within that calendar.
        </p>
        <p>AGOS may synchronize relevant work such as:</p>
        <ul>
          <li>Assigned work or gigs</li>
          <li>Workflow deadlines</li>
          <li>Shoot schedules</li>
          <li>Editing deadlines</li>
          <li>Review deadlines</li>
          <li>Publishing schedules</li>
          <li>Other work-related events you are authorized to view in AGOS</li>
        </ul>
        <p>
          AGOS does not use Google Calendar as an authorization system. Before
          synchronizing an event, AGOS applies its own workspace, membership,
          role, and resource-access rules.
        </p>
        <p>
          Google Calendar integration is optional and may be disconnected from
          AGOS settings.
        </p>
      </>
    ),
  },
  {
    id: "google-user-data",
    number: "7",
    title: "How We Use Google User Data",
    content: (
      <>
        <p>
          Information received from Google APIs is used only to provide
          user-facing AGOS functionality requested by the user.
        </p>
        <p>We may use Google user data to:</p>
        <ul>
          <li>Authenticate your AGOS account</li>
          <li>Display basic profile information</li>
          <li>Connect your Google Calendar</li>
          <li>Create and update AGOS-generated Google Calendar events</li>
          <li>
            Keep AGOS work deadlines synchronized with your connected Google
            Calendar
          </li>
          <li>Identify the connected Google account</li>
          <li>Maintain and troubleshoot the integration</li>
        </ul>
        <p>
          AGOS does not use Google user data for advertising. AGOS does not sell
          Google user data. AGOS does not use Google user data to build
          advertising profiles. AGOS does not transfer Google user data to third
          parties except where necessary to provide the requested service,
          comply with law, protect users, or operate infrastructure under
          appropriate confidentiality and security obligations.
        </p>
        <p>
          AGOS's use and transfer of information received from Google APIs will
          comply with the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: "google-oauth",
    number: "8",
    title: "Google OAuth Credentials",
    content: (
      <>
        <p>
          When you connect Google Calendar, AGOS may receive OAuth credentials
          required to maintain the integration.
        </p>
        <p>Where applicable:</p>
        <ul>
          <li>Refresh tokens are encrypted before storage.</li>
          <li>OAuth credentials are not exposed to the AGOS frontend.</li>
          <li>
            OAuth credentials are not intentionally written to application logs.
          </li>
          <li>
            Short-lived access tokens are used only when communicating with
            Google APIs.
          </li>
          <li>
            Credentials are used only for the Google functionality you
            authorized.
          </li>
        </ul>
        <p>
          You may disconnect Google Calendar at any time. When disconnected,
          AGOS stops future synchronization and removes or revokes stored
          authorization credentials where applicable. Disconnecting Google
          Calendar does not delete your AGOS account or your AGOS business data.
        </p>
      </>
    ),
  },
  {
    id: "email-normalization",
    number: "9",
    title: "Email Normalization and Identity Resolution",
    content: (
      <>
        <p>
          AGOS may normalize email addresses by trimming surrounding whitespace
          and converting letters to lowercase.
        </p>
        <p>This is used to:</p>
        <ul>
          <li>Prevent duplicate AGOS identities</li>
          <li>Match invited users with existing accounts</li>
          <li>Associate pending agency memberships</li>
          <li>Allow one account to access multiple agency workspaces</li>
          <li>Prevent duplicate employee or client identities</li>
        </ul>
        <p>
          AGOS does not intentionally remove Gmail dots, strip plus aliases, or
          perform provider-specific email rewriting unless this behavior is
          explicitly introduced and disclosed.
        </p>
      </>
    ),
  },
  {
    id: "notifications",
    number: "10",
    title: "Notifications",
    content: (
      <>
        <p>AGOS may generate notifications relating to:</p>
        <ul>
          <li>Work assignments</li>
          <li>Submissions</li>
          <li>Approvals</li>
          <li>Requested changes</li>
          <li>Workflow handoffs</li>
          <li>Deadlines</li>
          <li>Publishing schedules</li>
          <li>Workspace activity</li>
        </ul>
        <p>
          Depending on the features available and enabled, notifications may be
          delivered in-app or through connected communication services. AGOS
          will disclose additional notification integrations if they are
          introduced.
        </p>
      </>
    ),
  },
  {
    id: "external-links",
    number: "11",
    title: "External Links and Files",
    content: (
      <>
        <p>
          AGOS may allow users to attach external links, including links to
          services such as Google Drive or other content platforms.
        </p>
        <p>AGOS may store:</p>
        <ul>
          <li>Link URL</li>
          <li>File or resource title</li>
          <li>Resource type</li>
          <li>Associated work item</li>
          <li>Uploader information</li>
          <li>Metadata required to display the link</li>
        </ul>
        <p>
          AGOS does not necessarily host the underlying file. External services
          are governed by their own privacy policies and terms.
        </p>
      </>
    ),
  },
  {
    id: "how-we-share",
    number: "12",
    title: "How We Share Information",
    content: (
      <>
        <p>AGOS does not sell personal information.</p>
        <p>
          We may share information only when reasonably necessary for purposes
          such as:
        </p>
        <ul>
          <li>Providing AGOS services</li>
          <li>Hosting and cloud infrastructure</li>
          <li>Database services</li>
          <li>Authentication</li>
          <li>Email or notification delivery</li>
          <li>Monitoring and security</li>
          <li>Legal compliance</li>
          <li>Preventing fraud or abuse</li>
          <li>
            Protecting the rights and safety of AGOS, our users, or others
          </li>
        </ul>
        <p>
          Service providers may process information only as necessary to provide
          services to AGOS and subject to appropriate contractual or security
          obligations.
        </p>
      </>
    ),
  },
  {
    id: "agency-controlled-data",
    number: "13",
    title: "Agency-Controlled Data",
    content: (
      <>
        <p>
          Agencies using AGOS may provide information about employees,
          freelancers, clients, campaigns, and business operations.
        </p>
        <p>In many cases, the agency determines:</p>
        <ul>
          <li>What information is entered into AGOS</li>
          <li>Which users receive access</li>
          <li>What roles users receive</li>
          <li>Which clients or campaigns users can access</li>
          <li>Which work is assigned to each user</li>
        </ul>
        <p>
          Users should contact their agency administrator where a request
          concerns information controlled by that agency.
        </p>
      </>
    ),
  },
  {
    id: "multi-agency-privacy",
    number: "14",
    title: "Multi-Agency Privacy",
    content: (
      <>
        <p>A single AGOS user may belong to multiple agencies.</p>
        <p>
          AGOS separates access by agency membership and permissions. Being
          authorized to access Agency A does not automatically provide access to
          Agency B. AGOS applies agency-scoped access controls to reduce the
          risk of cross-agency data exposure.
        </p>
        <p>
          Users must not attempt to access information belonging to an agency
          they are not authorized to use.
        </p>
      </>
    ),
  },
  {
    id: "data-security",
    number: "15",
    title: "Data Security",
    content: (
      <>
        <p>
          AGOS uses technical and organizational safeguards intended to protect
          information. Depending on the information and system involved, these
          may include:
        </p>
        <ul>
          <li>Encryption of sensitive fields</li>
          <li>Secure authentication</li>
          <li>Hashed or protected authentication credentials</li>
          <li>Encrypted OAuth credentials</li>
          <li>Agency-level access controls</li>
          <li>Role and permission checks</li>
          <li>Secure cookies</li>
          <li>HTTPS</li>
          <li>Database access controls</li>
          <li>Audit and event records</li>
          <li>Restricted production configuration</li>
        </ul>
        <p>
          No system can guarantee absolute security, but AGOS works to protect
          user information from unauthorized access, alteration, disclosure, or
          destruction.
        </p>
      </>
    ),
  },
  {
    id: "data-retention",
    number: "16",
    title: "Data Retention",
    content: (
      <>
        <p>
          AGOS retains information for as long as reasonably necessary to:
        </p>
        <ul>
          <li>Provide the service</li>
          <li>Maintain accounts and workspace relationships</li>
          <li>Fulfill operational requirements</li>
          <li>Resolve disputes</li>
          <li>Maintain security and audit records</li>
          <li>Comply with applicable legal obligations</li>
        </ul>
        <p>
          Retention periods may vary depending on the type of information and
          the agency's use of AGOS. Where appropriate, deleted or archived
          records may remain in backups or audit records for a limited period.
        </p>
      </>
    ),
  },
  {
    id: "account-deletion",
    number: "17",
    title: "Account and Data Deletion",
    content: (
      <>
        <p>
          Users may request deletion of their AGOS account or eligible personal
          information.
        </p>
        <p>Some information may need to be retained where:</p>
        <ul>
          <li>
            It forms part of an agency's legitimate business records
          </li>
          <li>It is required for security or audit purposes</li>
          <li>Retention is required by law</li>
          <li>
            Removal would affect records belonging to other users or
            organizations
          </li>
        </ul>
        <p>
          Where possible, AGOS will remove, anonymize, or unlink personal
          information that is no longer required. For Google integrations, users
          may also revoke AGOS access through their Google Account permissions.
        </p>
      </>
    ),
  },
  {
    id: "workspace-removal",
    number: "18",
    title: "Workspace Removal and Suspension",
    content: (
      <>
        <p>
          If your membership in an agency is suspended or removed:
        </p>
        <ul>
          <li>
            You will no longer receive normal access to that workspace.
          </li>
          <li>
            AGOS will stop providing newly restricted workspace information
            through connected integrations where applicable.
          </li>
          <li>
            Your global AGOS account may remain active if you belong to other
            agencies.
          </li>
        </ul>
        <p>
          Historical records may remain where required for legitimate agency
          operations or audit history.
        </p>
      </>
    ),
  },
  {
    id: "cookies-sessions",
    number: "19",
    title: "Cookies and Sessions",
    content: (
      <>
        <p>
          AGOS uses cookies and similar technologies where necessary to:
        </p>
        <ul>
          <li>Maintain authenticated sessions</li>
          <li>Protect account security</li>
          <li>Remember certain preferences</li>
          <li>Operate workspace selection</li>
        </ul>
        <p>
          Authentication cookies may be configured as secure and HTTP-only where
          supported. AGOS does not require advertising cookies to provide its
          core platform functionality.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    number: "20",
    title: "Third-Party Services",
    content: (
      <>
        <p>
          AGOS may use third-party infrastructure and service providers such as:
        </p>
        <ul>
          <li>Cloud hosting providers</li>
          <li>Database providers</li>
          <li>Google authentication and Google APIs</li>
          <li>Email-delivery providers</li>
          <li>Messaging or queue infrastructure</li>
          <li>Monitoring or security services</li>
        </ul>
        <p>
          These providers process information according to their own terms,
          privacy policies, and agreements with AGOS. We aim to use providers
          appropriate for the type and sensitivity of information processed.
        </p>
      </>
    ),
  },
  {
    id: "international-processing",
    number: "21",
    title: "International Processing",
    content: (
      <p>
        AGOS infrastructure or service providers may process information in
        countries different from the country where you live. Where required,
        AGOS will take reasonable steps to use appropriate safeguards for
        cross-border processing.
      </p>
    ),
  },
  {
    id: "childrens-privacy",
    number: "22",
    title: "Children's Privacy",
    content: (
      <p>
        AGOS is intended for professional and business use and is not designed
        for children. We do not knowingly provide AGOS services to children
        where prohibited by applicable law.
      </p>
    ),
  },
  {
    id: "policy-changes",
    number: "23",
    title: "Changes to This Privacy Policy",
    content: (
      <p>
        We may update this Privacy Policy as AGOS evolves. If we materially
        change how we access, use, store, or share personal information or
        Google user data, we will update this policy and provide appropriate
        notice where required. The effective date at the top of this page
        indicates when the policy was last updated.
      </p>
    ),
  },
  {
    id: "your-choices",
    number: "24",
    title: "Your Choices",
    content: (
      <>
        <p>
          Depending on the features available to you, you may be able to:
        </p>
        <ul>
          <li>Update your profile</li>
          <li>Switch or leave agency workspaces</li>
          <li>Change certain preferences</li>
          <li>Disconnect Google Calendar</li>
          <li>Revoke Google access through your Google Account</li>
          <li>
            Request correction or deletion of eligible personal information
          </li>
          <li>Contact AGOS regarding privacy concerns</li>
        </ul>
      </>
    ),
  },
  {
    id: "contact-us",
    number: "25",
    title: "Contact Us",
    content: (
      <>
        <p>
          For privacy questions, data requests, or concerns relating to AGOS,
          contact:
        </p>
        <p>
          <strong>AGOS / EchoLift (Parent)</strong>
          <br />
          Email:{" "}
          <a href="mailto:echoliftagency@gmail.com">
            echoliftagency@gmail.com
          </a>
          <br />
          Website:{" "}
          <a
            href="https://client-agos.calcie.fun"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://client-agos.calcie.fun
          </a>
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground"
          >
            {/* Wordmark */}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent text-base font-bold tracking-tight">
              AGOS
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
        {/* Subtle glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-muted-foreground">
            Effective date:{" "}
            <time dateTime="2026-08-12">August 12, 2026</time>
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            AGOS ("AGOS", "we", "our", or "us") is an operating platform for
            digital marketing and creative agencies. This Privacy Policy explains
            how AGOS collects, uses, stores, protects, and shares information
            when you use our website, applications, integrations, and related
            services.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            By using AGOS, you acknowledge the practices described in this
            Privacy Policy.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col gap-0 lg:flex-row lg:gap-12">
          {/* Sticky sidebar TOC — hidden on mobile */}
          <aside className="hidden lg:block lg:w-64 shrink-0">
            <div className="sticky top-24">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Table of Contents
              </p>
              <nav aria-label="Privacy policy table of contents">
                <ol className="space-y-1">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-indigo-500">
                          {s.number}.
                        </span>
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                  <li>
                    <a
                      href="#google-limited-use"
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-indigo-500">
                        ★
                      </span>
                      <span>Google Limited Use</span>
                    </a>
                  </li>
                </ol>
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            <div className="prose-policy space-y-0">
              {sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  className="group scroll-mt-24"
                >
                  {/* Section card */}
                  <div
                    className={`rounded-2xl border border-border/50 bg-card p-8 transition-colors group-target:border-indigo-500/40 group-target:bg-indigo-500/5${
                      i < sections.length - 1 ? " mb-4" : ""
                    }`}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 font-mono text-xs font-bold text-indigo-400">
                        {s.number}
                      </span>
                      <h2 className="text-lg font-semibold text-foreground">
                        {s.title}
                      </h2>
                    </div>
                    <div className="policy-content text-sm leading-7 text-muted-foreground">
                      {s.content}
                    </div>
                  </div>
                </section>
              ))}

              {/* Google Limited Use disclosure */}
              <section
                id="google-limited-use"
                className="group scroll-mt-24 pt-4"
              >
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-sm text-indigo-400">
                      ★
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">
                      Google API Limited Use Disclosure
                    </h2>
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    AGOS's use and transfer to any other app of information
                    received from Google APIs will adhere to the{" "}
                    <a
                      href="https://developers.google.com/terms/api-services-user-data-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-indigo-400 underline underline-offset-4 hover:text-indigo-300"
                    >
                      Google API Services User Data Policy
                    </a>
                    , including the Limited Use requirements.
                  </p>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between">
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-sm font-bold tracking-tight text-transparent">
            AGOS
          </span>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} EchoLift. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link
              href="/privacy"
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:echoliftagency@gmail.com"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>

      {/* Inline styles for prose content */}
      <style>{`
        .policy-content p {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .policy-content p:first-child {
          margin-top: 0;
        }
        .policy-content p:last-child {
          margin-bottom: 0;
        }
        .policy-content h3 {
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
        }
        .policy-content ul {
          margin-top: 0.5rem;
          margin-bottom: 0.75rem;
          padding-left: 1.25rem;
          list-style-type: disc;
          space-y: 0.25rem;
        }
        .policy-content ul li {
          margin-bottom: 0.25rem;
        }
        .policy-content a {
          color: #818cf8;
          text-decoration: underline;
          text-underline-offset: 4px;
          transition: color 0.15s;
        }
        .policy-content a:hover {
          color: #a5b4fc;
        }
        .policy-content strong {
          color: var(--foreground);
          font-weight: 600;
        }

        /* Highlight when anchor-targeted */
        section:target > div {
          border-color: rgba(99, 102, 241, 0.4) !important;
          background-color: rgba(99, 102, 241, 0.05) !important;
        }
      `}</style>
    </div>
  );
}
