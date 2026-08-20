import { Injectable } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  clientScopeId,
  isClientUser,
} from "@packages/security/client-scope";
import {
  ApprovalStatus,
  BlockerStatus,
  CampaignAssignmentRole,
  ContentAssetStatus,
  ContentStage,
  Prisma,
  SubmissionStatus,
  TaskStatus,
  WorkOrderStatus,
} from "@prisma/client";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) { }

  async getDashboard(agencyId: string, actor: IdentityContext) {
    if (isClientUser(actor)) {
      return this.getClientDashboard(agencyId, actor);
    }

    const roleResponsibilities =
      this.canSeeAgencyWork(actor) || !actor.membershipId
        ? []
        : await this.campaignRoleResponsibilities(agencyId, actor.membershipId);
    const taskWhere = this.buildTaskWhere(
      agencyId,
      actor,
      roleResponsibilities,
    );
    const activityWhere = this.buildActivityWhere(
      agencyId,
      actor,
      roleResponsibilities,
    );

    const [
      clients,
      campaigns,
      contentAssets,
      pendingApprovals,
      blockedContent,
      publishingToday,
      recentActivity,
    ] = await Promise.all([
      this.prisma.client.count({ where: { agencyId, status: "ACTIVE" } }),
      this.prisma.campaign.count({ where: { agencyId, status: "ACTIVE" } }),
      this.prisma.contentAsset.count({
        where: { agencyId, status: ContentAssetStatus.ACTIVE },
      }),
      this.prisma.approval.count({
        where: {
          agencyId,
          status: ApprovalStatus.APPROVED,
        },
      }),
      this.prisma.blocker.count({
        where: {
          agencyId,
          status: BlockerStatus.ACTIVE,
        },
      }),
      this.prisma.contentAsset.count({
        where: {
          agencyId,
          status: ContentAssetStatus.ACTIVE,
        },
      }),
      this.prisma.workflowTransition.findMany({
        where: activityWhere,
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { workflowInstance: { include: { contentAsset: true } } },
      }),
    ]);

    const [tasks, workOrders] = await Promise.all([
      this.prisma.workflowTask.findMany({
        where: taskWhere,
        include: {
          workflowInstance: { include: { contentAsset: true } },
          workflowStep: true,
        },
        orderBy: { deadlineAt: "asc" },
        take: 8,
      }),
      this.prisma.workOrder.findMany({
        where: this.buildWorkOrderWhere(agencyId, actor),
        include: { client: true },
        orderBy: { dueAt: "asc" },
        take: 8,
      }),
    ]);

    const pendingReviews = await this.prisma.submission.count({
      where: { agencyId, status: SubmissionStatus.SUBMITTED },
    });

    return {
      myTasks: [
        ...tasks.map((task) => ({
          sourceType: "WORKFLOW_TASK",
          id: task.id,
          title: task.displayName,
          contentAssetId: task.workflowInstance.contentAssetId,
          workOrderId: null,
          displayCode: task.workflowInstance.contentAsset?.displayCode ?? null,
          campaignId: task.workflowInstance.contentAsset?.campaignId ?? null,
          clientId: task.workflowInstance.contentAsset?.clientId ?? null,
          contentAssetTitle:
            task.workflowInstance.contentAsset?.title ?? "Untitled content",
          status: task.status,
          deadlineAt: task.deadlineAt,
          stage: task.workflowStep?.stage ?? null,
        })),
        ...workOrders.map((workOrder) => ({
          sourceType: "WORK_ORDER",
          id: `work-order:${workOrder.id}`,
          title: workOrder.title,
          contentAssetId: null,
          workOrderId: workOrder.id,
          displayCode: null,
          campaignId: null,
          clientId: workOrder.clientId,
          contentAssetTitle:
            workOrder.client?.displayName ??
            workOrder.client?.name ??
            "Standalone gig",
          status: workOrder.status,
          deadlineAt: workOrder.dueAt,
          stage: workOrder.workType,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(a.deadlineAt ?? 0).getTime() -
            new Date(b.deadlineAt ?? 0).getTime(),
        )
        .slice(0, 8),
      pendingApprovals: pendingReviews,
      blockedContent: blockedContent,
      overdueContent:
        tasks.filter((task) => task.deadlineAt && task.deadlineAt < new Date())
          .length +
        workOrders.filter(
          (workOrder) =>
            workOrder.dueAt < new Date() &&
            !new Set<WorkOrderStatus>([
              WorkOrderStatus.COMPLETED,
              WorkOrderStatus.CANCELLED,
            ]).has(workOrder.status),
        ).length,
      publishingToday: publishingToday,
      activity: recentActivity.map((transition) => ({
        id: transition.id,
        contentAssetId: transition.workflowInstance.contentAssetId,
        displayCode:
          transition.workflowInstance.contentAsset?.displayCode ?? null,
        campaignId:
          transition.workflowInstance.contentAsset?.campaignId ?? null,
        clientId: transition.workflowInstance.contentAsset?.clientId ?? null,
        contentAssetTitle:
          transition.workflowInstance.contentAsset?.title ?? "Untitled content",
        toStage: transition.toStage,
        createdAt: transition.createdAt,
      })),
      riskSummary: {
        activeClients: clients,
        activeCampaigns: campaigns,
        activeContent: contentAssets,
        blockedItems: blockedContent,
      },
    };
  }

  private async getClientDashboard(agencyId: string, actor: IdentityContext) {
    const clientId = clientScopeId(actor);
    if (!clientId) {
      return this.emptyClientDashboard(
        "No client account has been assigned to your access. Contact your agency administrator.",
      );
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const contentAssetWhere: Prisma.ContentAssetWhereInput = {
      agencyId,
      clientId,
      status: ContentAssetStatus.ACTIVE,
    };
    const workflowTaskClientWhere: Prisma.WorkflowTaskWhereInput = {
      agencyId,
      workflowInstance: { contentAsset: { clientId } },
    };

    const [
      client,
      campaigns,
      contentAssets,
      blockedContent,
      publishingToday,
      tasks,
      workOrders,
      pendingReviews,
      recentActivity,
    ] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: clientId, agencyId, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, displayName: true },
      }),
      this.prisma.campaign.count({
        where: { agencyId, clientId, status: "ACTIVE" },
      }),
      this.prisma.contentAsset.count({ where: contentAssetWhere }),
      this.prisma.blocker.count({
        where: {
          agencyId,
          status: BlockerStatus.ACTIVE,
          workflowTask: {
            workflowInstance: { contentAsset: { clientId } },
          },
        },
      }),
      this.prisma.publishingSchedule.count({
        where: {
          agencyId,
          scheduledAt: { gte: todayStart, lt: todayEnd },
          campaign: { clientId },
        },
      }),
      this.prisma.workflowTask.findMany({
        where: {
          ...workflowTaskClientWhere,
          status: {
            in: [
              TaskStatus.TODO,
              TaskStatus.IN_PROGRESS,
              TaskStatus.WAITING_REVIEW,
              TaskStatus.WAITING_HANDOFF_ACCEPTANCE,
              TaskStatus.BLOCKED,
            ],
          },
        },
        include: {
          workflowInstance: { include: { contentAsset: true } },
          workflowStep: true,
        },
        orderBy: { deadlineAt: "asc" },
        take: 8,
      }),
      this.prisma.workOrder.findMany({
        where: {
          agencyId,
          clientId,
          deletedAt: null,
          status: {
            in: [
              WorkOrderStatus.ASSIGNED,
              WorkOrderStatus.IN_PROGRESS,
              WorkOrderStatus.SUBMITTED,
              WorkOrderStatus.CHANGES_REQUESTED,
            ],
          },
        },
        include: { client: true },
        orderBy: { dueAt: "asc" },
        take: 8,
      }),
      this.prisma.submission.count({
        where: {
          agencyId,
          status: SubmissionStatus.SUBMITTED,
          workflowTask: {
            workflowInstance: { contentAsset: { clientId } },
          },
        },
      }),
      this.prisma.workflowTransition.findMany({
        where: {
          agencyId,
          workflowInstance: { contentAsset: { clientId } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { workflowInstance: { include: { contentAsset: true } } },
      }),
    ]);

    if (!client) {
      return this.emptyClientDashboard(
        "No client account has been assigned to your access. Contact your agency administrator.",
      );
    }

    return {
      clientAccess: {
        assigned: true,
        clientId,
        clientName: client.displayName || client.name,
      },
      myTasks: [
        ...tasks.map((task) => ({
          sourceType: "WORKFLOW_TASK",
          id: task.id,
          title: task.displayName,
          contentAssetId: task.workflowInstance.contentAssetId,
          workOrderId: null,
          displayCode: task.workflowInstance.contentAsset?.displayCode ?? null,
          campaignId: task.workflowInstance.contentAsset?.campaignId ?? null,
          clientId: task.workflowInstance.contentAsset?.clientId ?? null,
          contentAssetTitle:
            task.workflowInstance.contentAsset?.title ?? "Untitled content",
          status: task.status,
          deadlineAt: task.deadlineAt,
          stage: task.workflowStep?.stage ?? null,
        })),
        ...workOrders.map((workOrder) => ({
          sourceType: "WORK_ORDER",
          id: `work-order:${workOrder.id}`,
          title: workOrder.title,
          contentAssetId: null,
          workOrderId: workOrder.id,
          displayCode: null,
          campaignId: null,
          clientId: workOrder.clientId,
          contentAssetTitle:
            workOrder.client?.displayName ??
            workOrder.client?.name ??
            "Standalone gig",
          status: workOrder.status,
          deadlineAt: workOrder.dueAt,
          stage: workOrder.workType,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(a.deadlineAt ?? 0).getTime() -
            new Date(b.deadlineAt ?? 0).getTime(),
        )
        .slice(0, 8),
      pendingApprovals: pendingReviews,
      blockedContent,
      overdueContent:
        tasks.filter((task) => task.deadlineAt && task.deadlineAt < new Date())
          .length +
        workOrders.filter(
          (workOrder) =>
            workOrder.dueAt < new Date() &&
            !new Set<WorkOrderStatus>([
              WorkOrderStatus.COMPLETED,
              WorkOrderStatus.CANCELLED,
            ]).has(workOrder.status),
        ).length,
      publishingToday,
      activity: recentActivity.map((transition) => ({
        id: transition.id,
        contentAssetId: transition.workflowInstance.contentAssetId,
        displayCode:
          transition.workflowInstance.contentAsset?.displayCode ?? null,
        campaignId:
          transition.workflowInstance.contentAsset?.campaignId ?? null,
        clientId: transition.workflowInstance.contentAsset?.clientId ?? null,
        contentAssetTitle:
          transition.workflowInstance.contentAsset?.title ?? "Untitled content",
        toStage: transition.toStage,
        createdAt: transition.createdAt,
      })),
      riskSummary: {
        activeClients: 1,
        activeCampaigns: campaigns,
        activeContent: contentAssets,
        blockedItems: blockedContent,
      },
    };
  }

  private emptyClientDashboard(message: string) {
    return {
      clientAccess: {
        assigned: false,
        clientId: null,
        clientName: null,
        message,
      },
      myTasks: [],
      pendingApprovals: 0,
      blockedContent: 0,
      overdueContent: 0,
      publishingToday: 0,
      activity: [],
      riskSummary: {
        activeClients: 0,
        activeCampaigns: 0,
        activeContent: 0,
        blockedItems: 0,
      },
    };
  }

  private buildWorkOrderWhere(
    agencyId: string,
    actor: IdentityContext,
  ): Prisma.WorkOrderWhereInput {
    const baseWhere: Prisma.WorkOrderWhereInput = {
      agencyId,
      deletedAt: null,
      status: {
        in: [
          WorkOrderStatus.ASSIGNED,
          WorkOrderStatus.IN_PROGRESS,
          WorkOrderStatus.SUBMITTED,
          WorkOrderStatus.CHANGES_REQUESTED,
        ],
      },
    };

    if (this.canSeeAgencyWork(actor)) return baseWhere;
    if (!actor.membershipId) {
      return { ...baseWhere, assigneeMembershipId: "__missing_membership__" };
    }

    return {
      ...baseWhere,
      OR: [
        { assigneeMembershipId: actor.membershipId },
        { reviewerMembershipId: actor.membershipId },
      ],
    };
  }

  private buildTaskWhere(
    agencyId: string,
    actor: IdentityContext,
    roleResponsibilities: Array<{ campaignId: string; stages: ContentStage[] }>,
  ): Prisma.WorkflowTaskWhereInput {
    const baseWhere: Prisma.WorkflowTaskWhereInput = {
      agencyId,
      status: {
        in: [
          TaskStatus.TODO,
          TaskStatus.IN_PROGRESS,
          TaskStatus.WAITING_REVIEW,
          TaskStatus.WAITING_HANDOFF_ACCEPTANCE,
          TaskStatus.BLOCKED,
        ],
      },
    };

    if (this.canSeeAgencyWork(actor)) {
      return baseWhere;
    }

    if (!actor.membershipId) {
      return { ...baseWhere, ownerMembershipId: "__missing_membership__" };
    }

    const directAssignment: Prisma.WorkflowTaskWhereInput = {
      ownerMembershipId: actor.membershipId,
    };
    const campaignResponsibilities = roleResponsibilities.map(
      (responsibility) => ({
        workflowInstance: {
          contentAsset: {
            campaignId: responsibility.campaignId,
          },
        },
        workflowStep: {
          stage: { in: responsibility.stages },
        },
      }),
    );

    return {
      ...baseWhere,
      OR: [directAssignment, ...campaignResponsibilities],
    };
  }

  private buildActivityWhere(
    agencyId: string,
    actor: IdentityContext,
    roleResponsibilities: Array<{ campaignId: string; stages: ContentStage[] }>,
  ): Prisma.WorkflowTransitionWhereInput {
    if (this.canSeeAgencyWork(actor)) {
      return { agencyId };
    }

    if (!actor.membershipId) {
      return { agencyId, workflowInstanceId: "__missing_membership__" };
    }

    const directAssignment: Prisma.WorkflowTaskWhereInput = {
      ownerMembershipId: actor.membershipId,
    };
    const campaignResponsibilities = roleResponsibilities.map(
      (responsibility) => ({
        workflowInstance: {
          contentAsset: {
            campaignId: responsibility.campaignId,
          },
        },
        workflowStep: {
          stage: { in: responsibility.stages },
        },
      }),
    );

    return {
      agencyId,
      workflowInstance: {
        tasks: {
          some: { OR: [directAssignment, ...campaignResponsibilities] },
        },
      },
    };
  }

  private canSeeAgencyWork(actor: IdentityContext): boolean {
    const roles = this.roleKeys(actor);
    return roles.some((role) => ["OWNER", "ADMIN", "MANAGER"].includes(role));
  }

  private async campaignRoleResponsibilities(
    agencyId: string,
    membershipId: string,
  ) {
    const assignments = await this.prisma.campaignTeamAssignment.findMany({
      where: { agencyId, membershipId },
      select: { campaignId: true, assignmentRole: true },
    });

    return assignments
      .map((assignment) => ({
        campaignId: assignment.campaignId,
        stages: this.stagesForCampaignRole(assignment.assignmentRole),
      }))
      .filter((assignment) => assignment.stages.length > 0);
  }

  private stagesForCampaignRole(role: CampaignAssignmentRole): ContentStage[] {
    const stagesByRole: Record<CampaignAssignmentRole, ContentStage[]> = {
      [CampaignAssignmentRole.CAMPAIGN_MANAGER]: [
        ContentStage.MANAGER_SCRIPT_REVIEW,
        ContentStage.MANAGER_EDIT_REVIEW,
        ContentStage.CLIENT_APPROVAL,
      ],
      [CampaignAssignmentRole.RELATIONSHIP_MANAGER]: [
        ContentStage.MANAGER_SCRIPT_REVIEW,
        ContentStage.MANAGER_EDIT_REVIEW,
        ContentStage.CLIENT_APPROVAL,
      ],
      [CampaignAssignmentRole.WRITER]: [ContentStage.WRITING],
      [CampaignAssignmentRole.EDITOR]: [
        ContentStage.EDITOR_INTAKE,
        ContentStage.EDITING,
      ],
      [CampaignAssignmentRole.DESIGNER]: [],
      [CampaignAssignmentRole.DOP]: [ContentStage.SHOOT],
      [CampaignAssignmentRole.SOCIAL_MEDIA_MANAGER]: [ContentStage.SCHEDULED],
      [CampaignAssignmentRole.CLIENT_APPROVER]: [ContentStage.CLIENT_APPROVAL],
      [CampaignAssignmentRole.AGENCY_APPROVER]: [
        ContentStage.MANAGER_SCRIPT_REVIEW,
        ContentStage.MANAGER_EDIT_REVIEW,
      ],
    };

    return stagesByRole[role] ?? [];
  }

  private roleKeys(actor: IdentityContext): string[] {
    return [...(actor.roles ?? []), actor.role ?? ""]
      .filter(Boolean)
      .map((role) => role.toUpperCase().replace(/[\s-]+/g, "_"));
  }
}
