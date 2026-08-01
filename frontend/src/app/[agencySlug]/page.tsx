"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardData, getDashboardData } from "@/lib/api/dashboard";
import { getActivation, ActivationState } from "@/lib/api/activation";
import { useAgency } from "@/components/AgencyProvider";
import { useRouter } from "next/navigation";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { isProductionWorkspaceRole, workspaceHomeLabel } from "@/lib/workspace-access";


type StepId = "agency" | "team" | "client" | "campaign" | "content" | "workflow";

type Step = {
  id: StepId;
  label: string;
  description: string;
  href: string;
};


const stepTemplates: Step[] = [
  { id: "agency", label: "Agency", description: "Workspace created", href: "" },
  { id: "team", label: "Team", description: "Onboard your team", href: "team" },
  { id: "client", label: "Client", description: "Create your first client", href: "clients" },
  { id: "campaign", label: "Campaign", description: "Launch the first campaign", href: "campaigns" },
  { id: "content", label: "Content", description: "Drop the first asset", href: "content" },
  { id: "workflow", label: "Workflow", description: "Start production", href: "workflow" },
];

export default function WorkspaceDashboard() {
  const [activation, setActivation] = useState<ActivationState | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const router = useRouter();
  const { agency, agencyId, agencySlug } = useAgency();
  const name = agency?.displayName || agency?.name || "Agency";
  const isMyWork = isProductionWorkspaceRole(agency);
  const homeLabel = workspaceHomeLabel(agency);

  useEffect(() => {
    let isMounted = true;

    if (!agencyId) return;

    Promise.all([getDashboardData(agencyId), getActivation(agencyId)])
      .then((data) => {
        if (isMounted) {
          setDashboardData(data[0]);
          setActivation(data[1]);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDashboardData({
            myTasks: [],
            pendingApprovals: 0,
            blockedContent: 0,
            overdueContent: 0,
            publishingToday: 0,
            activity: [],
            riskSummary: { activeClients: 0, activeCampaigns: 0, activeContent: 0, blockedItems: 0 },
          });
          setActivation({
            completed: false,
            progress: 0,
            steps: {
              agency: true,
              team: false,
              client: false,
              campaign: false,
              content: false,
              workflow: false,
            },
            nextStep: "CREATE_CLIENT",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId]);

  const steps = useMemo(
    () => stepTemplates.map((step) => ({ ...step, done: activation?.steps[step.id] ?? false })),
    [activation]
  );

  const progress = activation?.progress ?? 0;
  const showDashboard = activation?.steps.client ?? false;
  const myTasks = dashboardData?.myTasks ?? [];
  const dueTodayCount = myTasks.filter((task) => isToday(task.deadlineAt)).length;
  const waitingReviewCount = myTasks.filter((task) => /WAITING|REVIEW|APPROVAL/.test(task.status) || /REVIEW|APPROVAL/.test(task.stage || "")).length;
  const returnedCount = myTasks.filter((task) => /RETURN|CHANGE|REJECT/.test(task.status) || /RETURN|CHANGE|REJECT/.test(task.stage || "")).length;
  const overdueTaskCount = myTasks.filter((task) => isOverdue(task.deadlineAt)).length;
  const metrics = isMyWork
    ? [
        { label: "Assigned to me", value: myTasks.length, href: "workflow" },
        { label: "Due today", value: dueTodayCount, href: "calendar" },
        { label: "Waiting review", value: waitingReviewCount, href: "workflow" },
        { label: "Returned / overdue", value: returnedCount + overdueTaskCount, href: "workflow" },
      ]
    : [
        { label: "Active clients", value: dashboardData?.riskSummary.activeClients ?? 0, href: "clients" },
        { label: "Active campaigns", value: dashboardData?.riskSummary.activeCampaigns ?? 0, href: "campaigns" },
        { label: "Active content", value: dashboardData?.riskSummary.activeContent ?? 0, href: "content" },
        { label: "Blocked", value: dashboardData?.riskSummary.blockedItems ?? 0, href: "workflow" },
      ];

  const completeStep = (stepId: StepId) => {
    if (stepId === "team") {
      router.push(`/${agencySlug}/team/new`);
      return;
    }
    if (stepId === "client") {
      router.push(`/${agencySlug}/clients/new`);
      return;
    }
    router.push(`/${agencySlug}/${stepTemplates.find((step) => step.id === stepId)?.href ?? ""}/new`);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              {isMyWork ? "My work" : "Founder command center"}
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-white">
              {showDashboard ? (isMyWork ? "What needs your attention today" : `Good morning, ${name}`) : "Let’s set up your first workspace."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              {showDashboard
                ? isMyWork
                  ? "Assigned work appears here first. Finish what is due, respond to reviews, and keep your handoffs moving."
                  : "Your agency is moving. Use this view to focus on what needs attention today."
                : "Create your first client to unlock the dashboard and turn this workspace into a real operating system."}
            </p>
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300">
            {showDashboard ? (isMyWork ? homeLabel : "Operational view") : `${progress}% complete`}
          </div>
        </div>
      </div>

      {showDashboard ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => router.push(`/${agencySlug}/${card.href}`)}
                className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 text-left shadow-2xl shadow-black/20 transition hover:border-indigo-500/40 hover:bg-zinc-900/70"
              >
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Today’s priorities</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {isMyWork ? "Your work queue" : "What needs attention now"}
                  </h2>
                </div>
                <div className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-sm text-zinc-300">
                  {myTasks.length} tasks
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {myTasks.length > 0 ? (
                  myTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => task.contentAssetId && router.push(`/${agencySlug}/workflow/${task.contentAssetId}`)}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition hover:border-indigo-500/40 hover:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{task.title}</p>
                          <p className="mt-1 text-sm text-zinc-400">
                            {task.displayCode ? `${task.displayCode} · ` : ""}{task.contentAssetTitle}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">{task.deadlineAt ? `Due ${formatDateTime(task.deadlineAt)}` : "No deadline"}</p>
                        </div>
                        <div className={statusPillClasses(task.status, "sm")}>{formatLabel(task.status)}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
                    {isMyWork
                      ? "No work is assigned to you right now. When a manager assigns a stage to you, it will appear here."
                      : "No active tasks yet. Create a campaign and content asset to see the first work queue."}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                {isMyWork ? "Recent movement" : "Latest activity"}
              </p>
              <div className="mt-6 space-y-3">
                {(dashboardData?.activity ?? []).length > 0 ? (
                  (dashboardData?.activity ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.contentAssetId}
                      onClick={() => item.contentAssetId && router.push(`/${agencySlug}/workflow/${item.contentAssetId}`)}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition hover:border-indigo-500/40 hover:bg-zinc-900 disabled:cursor-default disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900/70"
                    >
                      <p className="text-sm font-semibold text-white">
                        {item.displayCode ? `${item.displayCode} · ` : ""}{item.contentAssetTitle}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">{formatLabel(item.toStage ?? "Updated")}</p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
                    {isMyWork
                      ? "Feedback and handoffs connected to your work will appear here."
                      : "Activity will appear here as content moves through the workflow."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>Workspace setup</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-zinc-900">
              <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-8 space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="mt-1 text-sm text-zinc-400">{step.description}</p>
                  </div>
                  <div className={statusPillClasses(step.done ? "COMPLETED" : "PENDING", "sm")}>
                    {step.done ? "✓" : "○"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Activation</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Your agency is ready.</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Start with the work that creates momentum. The rest of the workspace can follow.
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => completeStep("team")}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-left text-sm font-medium text-zinc-200 transition hover:border-indigo-500/50"
              >
                <span>Invite Team</span>
                <span className="text-zinc-400">Start</span>
              </button>

              <button
                onClick={() => completeStep("client")}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-left text-sm font-medium text-zinc-200 transition hover:border-indigo-500/50"
              >
                <span>Create Client</span>
                <span className="text-zinc-400">Next</span>
              </button>

              <button
                onClick={() => completeStep("campaign")}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-left text-sm font-medium text-zinc-200 transition hover:border-indigo-500/50"
              >
                <span>Create Campaign</span>
                <span className="text-zinc-400">Next</span>
              </button>

              <button
                onClick={() => completeStep("content")}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-left text-sm font-medium text-zinc-200 transition hover:border-indigo-500/50"
              >
                <span>Create Content</span>
                <span className="text-zinc-400">Next</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isOverdue(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
