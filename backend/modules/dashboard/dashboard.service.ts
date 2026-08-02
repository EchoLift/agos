import { Injectable } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  ApprovalStatus,
  BlockerStatus,
  CampaignAssignmentRole,
  ContentAssetStatus,
  ContentStage,
  Prisma,
  SubmissionStatus,
  TaskStatus,
} from "@prisma/client";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(agencyId: string, actor: IdentityContext) {
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

    const tasks = await this.prisma.workflowTask.findMany({
      where: taskWhere,
      include: {
        workflowInstance: { include: { contentAsset: true } },
        workflowStep: true,
      },
      orderBy: { deadlineAt: "asc" },
      take: 8,
    });

    const pendingReviews = await this.prisma.submission.count({
      where: { agencyId, status: SubmissionStatus.SUBMITTED },
    });

    return {
      myTasks: tasks.map((task) => ({
        id: task.id,
        title: task.displayName,
        contentAssetId: task.workflowInstance.contentAssetId,
        displayCode: task.workflowInstance.contentAsset?.displayCode ?? null,
        campaignId: task.workflowInstance.contentAsset?.campaignId ?? null,
        clientId: task.workflowInstance.contentAsset?.clientId ?? null,
        contentAssetTitle:
          task.workflowInstance.contentAsset?.title ?? "Untitled content",
        status: task.status,
        deadlineAt: task.deadlineAt,
        stage: task.workflowStep?.stage ?? null,
      })),
      pendingApprovals: pendingReviews,
      blockedContent: blockedContent,
      overdueContent: tasks.filter(
        (task) => task.deadlineAt && task.deadlineAt < new Date(),
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

    const stages = this.productionStagesFor(actor);
    const directAssignment: Prisma.WorkflowTaskWhereInput = {
      ownerMembershipId: actor.membershipId,
      ...(stages.length > 0 ? { workflowStep: { stage: { in: stages } } } : {}),
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

    const stages = this.productionStagesFor(actor);
    const directAssignment: Prisma.WorkflowTaskWhereInput = {
      ownerMembershipId: actor.membershipId,
      ...(stages.length > 0 ? { workflowStep: { stage: { in: stages } } } : {}),
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

  private productionStagesFor(actor: IdentityContext): ContentStage[] {
    const roles = this.roleKeys(actor);
    const stages = new Set<ContentStage>();

    if (roles.includes("WRITER")) {
      stages.add(ContentStage.WRITING);
    }

    if (roles.includes("DOP")) {
      stages.add(ContentStage.SHOOT);
    }

    if (roles.includes("EDITOR")) {
      stages.add(ContentStage.EDITOR_INTAKE);
      stages.add(ContentStage.EDITING);
    }

    if (roles.includes("SOCIAL_MEDIA_MANAGER")) {
      stages.add(ContentStage.SCHEDULED);
      stages.add(ContentStage.PUBLISHED);
    }

    return [...stages];
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
