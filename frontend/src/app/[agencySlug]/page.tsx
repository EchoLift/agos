"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgency } from "@/components/AgencyProvider";
import { useRouter } from "next/navigation";
import { formatLabel, statusPillClasses } from "@/lib/status-style";
import { hasAnyRole, isProductionWorkspaceRole, workspaceHomeLabel } from "@/lib/workspace-access";
import { getWorkspaceHref } from "@/lib/workspace-url";
import { queryKeys, staleTimes, useActivationQuery, useDashboardQuery } from "@/lib/query";
import { getCalendarEvents } from "@/lib/api/calendar";
import { getWorkOrders } from "@/lib/api/work-orders";
import { rememberedEntityKey, useRememberedEntityId } from "@/lib/remembered-tab";

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
  { id: "content", label: "Content Plan", description: "Plan campaign deliverables", href: "campaigns" },
  { id: "workflow", label: "Workflow", description: "Start production", href: "workflow" },
];

export default function WorkspaceDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { agency, agencyId, agencySlug } = useAgency();
  const dashboardQuery = useDashboardQuery(agencyId);
  const activationQuery = useActivationQuery(agencyId);
  const activation = activationQuery.data ?? null;
  const dashboardData = dashboardQuery.data ?? null;
  const name = agency?.displayName || agency?.name || "Agency";
  const isMyWork = isProductionWorkspaceRole(agency);
  const isClientWorkspace = hasAnyRole(agency, ["CLIENT"]);
  const homeLabel = workspaceHomeLabel(agency);
  const safeAgencySlug = agencySlug ?? "";
  const rememberedClientId = useRememberedEntityId(
    rememberedEntityKey("client", agencyId),
  );
  const rememberedCampaignId = useRememberedEntityId(
    rememberedEntityKey("campaign", agencyId),
  );
  const rememberedGigId = useRememberedEntityId(
    rememberedEntityKey("gig", agencyId),
  );
  const rememberedWorkflowId = useRememberedEntityId(
    rememberedEntityKey("workflow", agencyId),
  );

  const steps = useMemo(
    () => stepTemplates.map((step) => ({ ...step, done: activation?.steps[step.id] ?? false })),
    [activation]
  );

  const progress = activation?.progress ?? 0;
  const showDashboard = isMyWork ? true : (activation?.steps.client ?? false);
  const missingClientAssignment =
    isClientWorkspace && dashboardData?.clientAccess?.assigned === false;
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
        {
          label: "Returned / overdue",
          value: returnedCount + overdueTaskCount,
          href: "workflow",
        },
      ]
    : isClientWorkspace
      ? [
          {
            label: "Your client",
            value: dashboardData?.riskSummary.activeClients ?? 0,
            href: "campaigns",
          },
          {
            label: "Active campaigns",
            value: dashboardData?.riskSummary.activeCampaigns ?? 0,
            href: "campaigns",
          },
          {
            label: "Active content",
            value: dashboardData?.riskSummary.activeContent ?? 0,
            href: "campaigns",
          },
          {
            label: "Publishing today",
            value: dashboardData?.publishingToday ?? 0,
            href: "calendar",
          },
        ]
      : [
          {
            label: "Active clients",
            value: dashboardData?.riskSummary.activeClients ?? 0,
            href: "clients",
          },
          {
            label: "Active campaigns",
            value: dashboardData?.riskSummary.activeCampaigns ?? 0,
            href: "campaigns",
          },
          {
            label: "Active content",
            value: dashboardData?.riskSummary.activeContent ?? 0,
            href: "campaigns",
          },
          {
            label: "Blocked",
            value: dashboardData?.riskSummary.blockedItems ?? 0,
            href: "workflow",
          },
        ];

  const completeStep = (stepId: StepId) => {
    if (stepId === "team") {
      router.push(getWorkspaceHref(safeAgencySlug, "/team/new"));
      return;
    }
    if (stepId === "client") {
      router.push(getWorkspaceHref(safeAgencySlug, "/clients/new"));
      return;
    }
    if (stepId === "content") {
      router.push(getWorkspaceHref(safeAgencySlug, "/campaigns"));
      return;
    }
    router.push(getWorkspaceHref(safeAgencySlug, `/${stepTemplates.find((step) => step.id === stepId)?.href ?? ""}/new`));
  };

  const workspaceSectionHref = (href: string) => {
    if (href === "clients" && rememberedClientId) {
      return getWorkspaceHref(safeAgencySlug, `/clients/${rememberedClientId}`);
    }

    if (href === "campaigns" && rememberedCampaignId) {
      return getWorkspaceHref(safeAgencySlug, `/campaigns/${rememberedCampaignId}`);
    }

    if (href === "gigs" && rememberedGigId) {
      return getWorkspaceHref(safeAgencySlug, `/gigs/${rememberedGigId}`);
    }

    if (href === "workflow" && rememberedWorkflowId) {
      return getWorkspaceHref(safeAgencySlug, `/workflow/${rememberedWorkflowId}`);
    }

    return getWorkspaceHref(safeAgencySlug, `/${href}`);
  };

  useEffect(() => {
    if (!agencyId || !dashboardData) return;
    const calendarFilters = {
      scope: isMyWork || isClientWorkspace
        ? "MY_SCHEDULE" as const
        : "AGENCY" as const,
      ...currentMonthRange(),
    };
    const prefetch = () => {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.calendar(agencyId, calendarFilters),
        queryFn: () => getCalendarEvents(agencyId, calendarFilters),
        staleTime: staleTimes.calendar,
      });
      if (isClientWorkspace) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.gigs(agencyId),
        queryFn: () => getWorkOrders(agencyId),
        staleTime: staleTimes.gigs,
      });
    };
    const idleId = window.requestIdleCallback(prefetch, { timeout: 2500 });
    return () => window.cancelIdleCallback(idleId);
  }, [agencyId, dashboardData, isClientWorkspace, isMyWork, queryClient]);

  const firstLoadError =
    !dashboardData && dashboardQuery.error
      ? dashboardQuery.error instanceof Error
        ? dashboardQuery.error.message
        : "Failed to load dashboard."
      : !activation && activationQuery.error
        ? activationQuery.error instanceof Error
          ? activationQuery.error.message
          : "Failed to load workspace activation."
        : null;

  if ((dashboardQuery.isLoading || activationQuery.isLoading) && !dashboardData && !activation) {
    return <DashboardSkeleton />;
  }

  if (firstLoadError) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {firstLoadError}
      </div>
    );
  }

  if (missingClientAssignment) {
    return (
      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-amber-100">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-200/70">
          Client access
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          No client account assigned
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/80">
          {dashboardData?.clientAccess?.message ??
            "No client account has been assigned to your access. Contact your agency administrator."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-8">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/10 lg:rounded-3xl lg:p-8 lg:shadow-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              {isClientWorkspace
                ? dashboardData?.clientAccess?.clientName ?? "Client dashboard"
                : isMyWork
                  ? "My work"
                  : "Founder command center"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:mt-2 lg:text-4xl">
              {showDashboard
                ? isClientWorkspace
                  ? "Your campaigns and approvals"
                  : isMyWork
                    ? "What needs your attention today"
                    : `Good morning, ${name}`
                : "Let’s set up your first workspace."}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 lg:mt-3 lg:leading-7">
              {showDashboard
                ? isMyWork
                  ? "Assigned work appears here first. Finish what is due, respond to reviews, and keep your handoffs moving."
                  : isClientWorkspace
                    ? "Track active campaigns, upcoming publishing, and work awaiting your review."
                  : "Your agency is moving. Use this view to focus on what needs attention today."
                : "Create your first client to unlock the dashboard and turn this workspace into a real operating system."}
            </p>
          </div>
          <div className="w-fit rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300 lg:rounded-full lg:px-4">
            {dashboardQuery.isFetching || activationQuery.isFetching
              ? "Refreshing..."
              : showDashboard
                ? (isMyWork ? homeLabel : "Operational view")
                : `${progress}% complete`}
          </div>
        </div>
      </div>

      {showDashboard ? (
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          <div className="grid grid-cols-2 gap-2 lg:gap-4 xl:grid-cols-4">
            {metrics.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => router.push(workspaceSectionHref(card.href))}
                className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-left shadow-lg shadow-black/10 transition hover:border-indigo-500/40 hover:bg-zinc-900/70 lg:rounded-3xl lg:p-6 lg:shadow-2xl"
              >
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white lg:mt-3 lg:text-3xl">{card.value}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:gap-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/10 lg:rounded-3xl lg:p-8 lg:shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Today’s priorities</p>
                  <h2 className="mt-1 text-xl font-semibold text-white lg:mt-2 lg:text-2xl">
                    {isMyWork ? "Your work queue" : "What needs attention now"}
                  </h2>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300 lg:rounded-full lg:px-3 lg:text-sm">
                  {myTasks.length} tasks
                </div>
              </div>

              <div className="mt-3 space-y-2 lg:mt-6 lg:space-y-3">
                {myTasks.length > 0 ? (
                  myTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        if (task.workOrderId) router.push(getWorkspaceHref(safeAgencySlug, `/gigs/${task.workOrderId}`));
                        else if (task.contentAssetId) router.push(getWorkspaceHref(safeAgencySlug, `/workflow/${task.contentAssetId}`));
                      }}
                      className="min-h-20 w-full rounded-md border border-zinc-800 bg-zinc-900/70 p-3 text-left transition hover:border-indigo-500/40 hover:bg-zinc-900 lg:rounded-2xl lg:p-4"
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
                  <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400 lg:rounded-2xl lg:p-6">
                    {isMyWork
                      ? "No work is assigned to you right now. When a manager assigns a stage to you, it will appear here."
                      : "No active tasks yet. Create a campaign and content asset to see the first work queue."}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-xl shadow-black/10 lg:rounded-3xl lg:p-8 lg:shadow-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                {isMyWork ? "Recent movement" : "Latest activity"}
              </p>
              <div className="mt-3 space-y-2 lg:mt-6 lg:space-y-3">
                {(dashboardData?.activity ?? []).length > 0 ? (
                  (dashboardData?.activity ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.contentAssetId}
                      onClick={() => item.contentAssetId && router.push(getWorkspaceHref(safeAgencySlug, `/workflow/${item.contentAssetId}`))}
                      className="min-h-16 w-full rounded-md border border-zinc-800 bg-zinc-900/70 p-3 text-left transition hover:border-indigo-500/40 hover:bg-zinc-900 disabled:cursor-default disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900/70 lg:rounded-2xl lg:p-4"
                    >
                      <p className="text-sm font-semibold text-white">
                        {item.displayCode ? `${item.displayCode} · ` : ""}{item.contentAssetTitle}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">{formatLabel(item.toStage ?? "Updated")}</p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400 lg:rounded-2xl lg:p-6">
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
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>Workspace setup</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-zinc-900">
              <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-4 space-y-3">
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

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 shadow-2xl shadow-black/20">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Activation</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Your agency is ready.</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Start with the work that creates momentum. The rest of the workspace can follow.
            </p>

            <div className="mt-4 space-y-3">
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
                <span>Open Content Plans</span>
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

function currentMonthRange() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-8">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 lg:rounded-3xl lg:p-8">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 h-9 w-2/3 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
            <div className="mt-4 h-8 w-12 animate-pulse rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
