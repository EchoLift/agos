import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  CampaignAssignmentRole,
  ContentRisk,
  PublishingPlatform,
  PublishingStatus,
  TaskStatus,
  WorkOrderStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  clientScopeIds,
  isClientUser,
} from "@packages/security/client-scope";
import {
  CalendarEventsQueryDto,
  CalendarScope,
} from "./dto/calendar-events-query.dto";

type CalendarEventType =
  | "WORKFLOW_TASK"
  | "SHOOT"
  | "REVIEW"
  | "APPROVAL"
  | "PUBLISHING"
  | "CAMPAIGN_MILESTONE"
  | "CLIENT_MEETING"
  | "TEAM_EVENT"
  | "WORK_ORDER";

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(query: CalendarEventsQueryDto, actor: IdentityContext) {
    const agencyId = actor.agencyId ?? "";
    const membershipId = actor.membershipId;
    if (!agencyId || !membershipId) {
      throw new BadRequestException("Agency membership context is required");
    }

    const scope = this.resolveScope(
      query.scope ?? this.defaultScope(actor),
      actor,
    );
    const { from, to } = this.resolveRange(query);
    const eventTypes = this.csv(query.eventTypes);
    const statuses = this.csv(query.statuses);
    const platforms = this.csv(query.platforms);
    const clientIds = isClientUser(actor) ? clientScopeIds(actor) : [];
    this.ensureMemberFilterAccess(query.memberId, membershipId, actor);
    const accessibleCampaignIds = await this.resolveAccessibleCampaignIds(
      scope,
      agencyId,
      membershipId,
      actor,
      query,
    );
    const roleKeys = this.roleKeys(actor);
    const taskStatuses = this.enumValues(TaskStatus, statuses);
    const publishingStatuses = this.enumValues(PublishingStatus, statuses);
    const workOrderStatuses = this.enumValues(WorkOrderStatus, statuses);
    const publishingPlatforms = this.enumValues(PublishingPlatform, platforms);

    const [taskEvents, publishingEvents, workOrderEvents] = await Promise.all([
      !eventTypes.length ||
      eventTypes.some((type) =>
        ["WORKFLOW_TASK", "SHOOT", "REVIEW", "APPROVAL"].includes(type),
      )
        ? this.getWorkflowTaskEvents({
            agencyId,
            membershipId,
            roleKeys,
            scope,
            from,
            to,
            campaignId: query.campaignId,
            memberId: query.memberId,
            statuses: taskStatuses,
            rawStatuses: statuses,
            accessibleCampaignIds,
            clientIds,
          })
        : Promise.resolve([]),
      !eventTypes.length || eventTypes.includes("PUBLISHING")
        ? this.getPublishingEvents({
            agencyId,
            membershipId,
            roleKeys,
            scope,
            from,
            to,
            campaignId: query.campaignId,
            statuses: publishingStatuses,
            rawStatuses: statuses,
            platforms: publishingPlatforms,
            rawPlatforms: platforms,
            accessibleCampaignIds,
            clientIds,
          })
        : Promise.resolve([]),
      !eventTypes.length || eventTypes.includes("WORK_ORDER")
        ? this.getWorkOrderEvents({
            agencyId,
            membershipId,
            roleKeys,
            scope,
            from,
            to,
            memberId: query.memberId,
            statuses: workOrderStatuses,
            rawStatuses: statuses,
            clientIds,
          })
        : Promise.resolve([]),
    ]);

    const events = [
      ...taskEvents,
      ...publishingEvents,
      ...workOrderEvents,
    ].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

    return {
      scope,
      range: { from: from.toISOString(), to: to.toISOString() },
      events,
      summary: {
        total: events.length,
        assignedToMe: events.filter((event) =>
          event.assignedMembershipIds.includes(membershipId),
        ).length,
        publishing: events.filter((event) => event.eventType === "PUBLISHING")
          .length,
        overdue: events.filter(
          (event) => event.riskStatus === ContentRisk.OVERDUE,
        ).length,
      },
    };
  }

  private async getWorkflowTaskEvents(params: {
    agencyId: string;
    membershipId: string;
    roleKeys: string[];
    scope: CalendarScope;
    from: Date;
    to: Date;
    campaignId?: string;
    memberId?: string;
    statuses: TaskStatus[];
    rawStatuses: string[];
    accessibleCampaignIds?: string[];
    clientIds?: string[];
  }) {
    if (params.rawStatuses.length && !params.statuses.length) return [];
    const roleResponsibilities =
      params.scope === "MY_SCHEDULE"
        ? await this.campaignRoleResponsibilities(
            params.agencyId,
            params.membershipId,
            params.campaignId,
          )
        : [];

    const where: any = {
      agencyId: params.agencyId,
      deadlineAt: { gte: params.from, lte: params.to },
      ...(params.statuses.length ? { status: { in: params.statuses } } : {}),
      ...(params.campaignId
        ? {
            workflowInstance: {
              contentAsset: { campaignId: params.campaignId },
            },
          }
        : {}),
    };

    if (params.clientIds?.length) {
      where.workflowInstance = {
        ...(where.workflowInstance ?? {}),
        contentAsset: {
          ...(where.workflowInstance?.contentAsset ?? {}),
          clientId: { in: params.clientIds },
        },
      };
    } else if (params.scope === "MY_SCHEDULE") {
      where.OR = [
        { ownerMembershipId: params.membershipId },
        ...roleResponsibilities.map((responsibility) => ({
          workflowInstance: {
            contentAsset: {
              campaignId: responsibility.campaignId,
            },
          },
          workflowStep: {
            stage: { in: responsibility.stages },
          },
        })),
      ];
    } else if (params.scope === "MY_ROLE") {
      where.owner = {
        OR: [
          {
            role: {
              systemRole: {
                key: { in: params.roleKeys },
              },
            },
          },
          {
            roles: {
              some: {
                role: {
                  systemRole: {
                    key: { in: params.roleKeys },
                  },
                },
              },
            },
          },
        ],
      };
    } else if (params.scope === "MY_TEAM" || params.scope === "CAMPAIGN") {
      where.workflowInstance = {
        ...(where.workflowInstance ?? {}),
        contentAsset: {
          ...(where.workflowInstance?.contentAsset ?? {}),
          campaignId: this.campaignIdFilter(
            params.campaignId,
            params.accessibleCampaignIds ?? [],
          ),
        },
      };
    } else if (params.scope !== "AGENCY") {
      where.ownerMembershipId = params.membershipId;
    }

    if (params.memberId && params.memberId !== params.membershipId) {
      where.ownerMembershipId = params.memberId;
    }

    const tasks = await this.prisma.workflowTask.findMany({
      where,
      include: {
        owner: {
          include: {
            user: true,
            role: { include: { systemRole: true } },
            roles: { include: { role: { include: { systemRole: true } } } },
          },
        },
        workflowStep: true,
        workflowInstance: {
          include: {
            contentAsset: {
              include: {
                campaign: true,
                client: true,
              },
            },
          },
        },
      },
      orderBy: { deadlineAt: "asc" },
    });

    return tasks.map((task) => {
      const eventType = this.taskEventType(task.workflowStep?.stage);
      const riskStatus = this.taskRisk(task.status, task.deadlineAt);
      const contentAsset = task.workflowInstance.contentAsset;
      const isDirectAssignment = task.ownerMembershipId === params.membershipId;
      const isRoleResponsibility = this.isCampaignRoleResponsible(
        roleResponsibilities,
        contentAsset.campaignId,
        task.workflowStep?.stage,
      );
      const assignedMembershipIds = [
        ...new Set([
          ...(task.ownerMembershipId ? [task.ownerMembershipId] : []),
          ...(isRoleResponsibility ? [params.membershipId] : []),
        ]),
      ];

      return {
        id: `task:${task.id}`,
        sourceId: task.id,
        eventType,
        title:
          task.displayName ||
          `${this.labelize(eventType)} ${contentAsset.displayCode}`,
        startsAt: task.deadlineAt.toISOString(),
        endsAt: task.deadlineAt.toISOString(),
        assignedMembershipIds,
        roleKeys: task.owner ? this.membershipRoleKeys(task.owner) : [],
        campaign: {
          id: contentAsset.campaign.id,
          name: contentAsset.campaign.name,
        },
        client: {
          id: contentAsset.client.id,
          name: contentAsset.client.displayName ?? contentAsset.client.name,
        },
        contentAsset: {
          id: contentAsset.id,
          displayCode: contentAsset.displayCode,
          title: contentAsset.title,
        },
        visibility: isDirectAssignment
          ? "DIRECT_ASSIGNMENT"
          : isRoleResponsibility
            ? "CAMPAIGN_ROLE"
            : "DIRECT_ASSIGNMENT",
        status: task.status,
        riskStatus,
        owner: task.owner
          ? {
              membershipId: task.owner.id,
              name: task.owner.user.name ?? "Unassigned",
            }
          : null,
        forwardedToMe: assignedMembershipIds.includes(params.membershipId),
        reason: isDirectAssignment
          ? "Assigned to me"
          : isRoleResponsibility
            ? `${this.labelize(task.workflowStep?.stage ?? "workflow")} responsibility from campaign team`
            : this.labelize(params.scope),
      };
    });
  }

  private async getPublishingEvents(params: {
    agencyId: string;
    membershipId: string;
    roleKeys: string[];
    scope: CalendarScope;
    from: Date;
    to: Date;
    campaignId?: string;
    statuses: PublishingStatus[];
    rawStatuses: string[];
    platforms: PublishingPlatform[];
    rawPlatforms: string[];
    accessibleCampaignIds?: string[];
    clientIds?: string[];
  }) {
    if (
      (params.rawStatuses.length && !params.statuses.length) ||
      (params.rawPlatforms.length && !params.platforms.length)
    )
      return [];

    const where: any = {
      agencyId: params.agencyId,
      scheduledAt: { gte: params.from, lte: params.to },
      ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      ...(params.statuses.length ? { status: { in: params.statuses } } : {}),
      ...(params.platforms.length
        ? { platform: { in: params.platforms } }
        : {}),
    };

    if (params.clientIds?.length) {
      where.campaign = { clientId: { in: params.clientIds } };
    } else if (params.scope === "MY_SCHEDULE") {
      const campaignIds = await this.campaignIdsForDirectPublishing(
        params.agencyId,
        params.membershipId,
      );
      where.campaignId = this.campaignIdFilter(params.campaignId, campaignIds);
    } else if (params.scope === "MY_TEAM" || params.scope === "CAMPAIGN") {
      where.campaignId = this.campaignIdFilter(
        params.campaignId,
        params.accessibleCampaignIds ?? [],
      );
    }

    const slots = await this.prisma.publishingSchedule.findMany({
      where,
      include: {
        campaign: { include: { client: true } },
        contentAsset: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    return slots.map((slot) => ({
      id: `publishing:${slot.id}`,
      sourceId: slot.id,
      eventType: "PUBLISHING" as CalendarEventType,
      title: `${this.labelize(slot.platform)} ${slot.contentAsset?.displayCode ?? "publishing slot"}`,
      startsAt: slot.scheduledAt.toISOString(),
      endsAt: slot.scheduledAt.toISOString(),
      assignedMembershipIds: [] as string[],
      roleKeys: ["SOCIAL_MEDIA_MANAGER"],
      campaign: { id: slot.campaign.id, name: slot.campaign.name },
      client: {
        id: slot.campaign.client.id,
        name: slot.campaign.client.displayName ?? slot.campaign.client.name,
      },
      contentAsset: slot.contentAsset
        ? {
            id: slot.contentAsset.id,
            displayCode: slot.contentAsset.displayCode,
            title: slot.contentAsset.title,
          }
        : null,
      visibility: "CAMPAIGN_TEAM",
      status: slot.status,
      riskStatus: this.publishingRisk(slot.status, slot.scheduledAt),
      platform: slot.platform,
      owner: null,
      forwardedToMe: params.roleKeys.includes("SOCIAL_MEDIA_MANAGER"),
      reason: params.roleKeys.includes("SOCIAL_MEDIA_MANAGER")
        ? "Publishing work for my role"
        : this.labelize(params.scope),
    }));
  }

  private async getWorkOrderEvents(params: {
    agencyId: string;
    membershipId: string;
    roleKeys: string[];
    scope: CalendarScope;
    from: Date;
    to: Date;
    memberId?: string;
    statuses: WorkOrderStatus[];
    rawStatuses: string[];
    clientIds?: string[];
  }) {
    if (params.rawStatuses.length && !params.statuses.length) return [];

    const where: any = {
      agencyId: params.agencyId,
      deletedAt: null,
      dueAt: { gte: params.from, lte: params.to },
      ...(params.statuses.length ? { status: { in: params.statuses } } : {}),
    };

    if (params.clientIds?.length) {
      where.clientId = { in: params.clientIds };
    } else if (params.scope === "MY_SCHEDULE") {
      where.OR = [
        { assigneeMembershipId: params.membershipId },
        { reviewerMembershipId: params.membershipId },
      ];
    } else if (params.scope === "MY_ROLE") {
      where.assignee = {
        OR: [
          {
            role: {
              systemRole: {
                key: { in: params.roleKeys },
              },
            },
          },
          {
            roles: {
              some: {
                role: {
                  systemRole: {
                    key: { in: params.roleKeys },
                  },
                },
              },
            },
          },
        ],
      };
    } else if (params.scope !== "AGENCY" && params.scope !== "MY_TEAM") {
      where.assigneeMembershipId = params.membershipId;
    }

    if (params.memberId && params.memberId !== params.membershipId) {
      where.OR = [
        { assigneeMembershipId: params.memberId },
        { reviewerMembershipId: params.memberId },
      ];
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where,
      include: {
        client: true,
        assignee: {
          include: {
            user: true,
            role: { include: { systemRole: true } },
            roles: { include: { role: { include: { systemRole: true } } } },
          },
        },
        reviewer: {
          include: {
            user: true,
            role: { include: { systemRole: true } },
            roles: { include: { role: { include: { systemRole: true } } } },
          },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    return workOrders.map((workOrder) => {
      const assignedMembershipIds = [
        ...new Set(
          [
            workOrder.assigneeMembershipId,
            workOrder.reviewerMembershipId,
          ].filter(Boolean) as string[],
        ),
      ];
      const isDirectAssignment = assignedMembershipIds.includes(
        params.membershipId,
      );

      return {
        id: `work-order:${workOrder.id}`,
        sourceId: workOrder.id,
        eventType: "WORK_ORDER" as CalendarEventType,
        title: workOrder.title,
        startsAt: workOrder.dueAt.toISOString(),
        endsAt: workOrder.dueAt.toISOString(),
        assignedMembershipIds,
        roleKeys: workOrder.assignee
          ? this.membershipRoleKeys(workOrder.assignee)
          : [],
        campaign: null,
        client: workOrder.client
          ? {
              id: workOrder.client.id,
              name: workOrder.client.displayName ?? workOrder.client.name,
            }
          : null,
        contentAsset: null,
        workOrder: {
          id: workOrder.id,
          title: workOrder.title,
          workType: workOrder.workType,
        },
        visibility: isDirectAssignment
          ? "DIRECT_ASSIGNMENT"
          : this.labelize(params.scope),
        status: workOrder.status,
        riskStatus: this.workOrderRisk(workOrder.status, workOrder.dueAt),
        owner: workOrder.assignee
          ? {
              membershipId: workOrder.assignee.id,
              name: workOrder.assignee.user.name ?? "Unassigned",
            }
          : null,
        forwardedToMe: isDirectAssignment,
        reason: isDirectAssignment
          ? "Assigned to me"
          : this.labelize(params.scope),
      };
    });
  }

  private async resolveAccessibleCampaignIds(
    scope: CalendarScope,
    agencyId: string,
    membershipId: string,
    actor: IdentityContext,
    query: CalendarEventsQueryDto,
  ) {
    if (scope === "AGENCY") {
      this.ensureAgencyScope(actor);
      return undefined;
    }

    if (scope === "CAMPAIGN") {
      if (!query.campaignId) return [];
      const canAccess = await this.canAccessCampaign(
        agencyId,
        membershipId,
        actor,
        query.campaignId,
      );
      return canAccess ? [query.campaignId] : [];
    }

    if (scope !== "MY_TEAM") return undefined;

    const assignments = await this.prisma.campaignTeamAssignment.findMany({
      where: {
        agencyId,
        membershipId,
        assignmentRole: {
          in: [
            CampaignAssignmentRole.CAMPAIGN_MANAGER,
            CampaignAssignmentRole.RELATIONSHIP_MANAGER,
          ],
        },
      },
      select: { campaignId: true },
    });

    return assignments.map((assignment) => assignment.campaignId);
  }

  private async canAccessCampaign(
    agencyId: string,
    membershipId: string,
    actor: IdentityContext,
    campaignId: string,
  ) {
    if (isClientUser(actor)) {
      const clientIds = clientScopeIds(actor);
      const campaign = await this.prisma.campaign.findFirst({
        where: {
          id: campaignId,
          agencyId,
          clientId: { in: clientIds },
          status: { not: "DELETED" },
        },
        select: { id: true },
      });
      return Boolean(campaign);
    }
    if (this.isOwnerOrManager(actor)) return true;
    const assignment = await this.prisma.campaignTeamAssignment.findFirst({
      where: { agencyId, campaignId, membershipId },
    });
    return Boolean(assignment);
  }

  private async campaignIdsForDirectPublishing(
    agencyId: string,
    membershipId: string,
  ) {
    const assignments = await this.prisma.campaignTeamAssignment.findMany({
      where: {
        agencyId,
        membershipId,
        assignmentRole: CampaignAssignmentRole.SOCIAL_MEDIA_MANAGER,
      },
      select: { campaignId: true },
    });
    return assignments.map((assignment) => assignment.campaignId);
  }

  private async campaignRoleResponsibilities(
    agencyId: string,
    membershipId: string,
    campaignId?: string,
  ) {
    const assignments = await this.prisma.campaignTeamAssignment.findMany({
      where: {
        agencyId,
        membershipId,
        ...(campaignId ? { campaignId } : {}),
      },
      select: { campaignId: true, assignmentRole: true },
    });

    return assignments
      .map((assignment) => ({
        campaignId: assignment.campaignId,
        assignmentRole: assignment.assignmentRole,
        stages: this.stagesForCampaignRole(assignment.assignmentRole),
      }))
      .filter((assignment) => assignment.stages.length > 0);
  }

  private isCampaignRoleResponsible(
    responsibilities: Array<{ campaignId: string; stages: string[] }>,
    campaignId: string,
    stage?: string | null,
  ) {
    if (!stage) return false;
    return responsibilities.some(
      (responsibility) =>
        responsibility.campaignId === campaignId &&
        responsibility.stages.includes(stage),
    );
  }

  private stagesForCampaignRole(role: CampaignAssignmentRole) {
    const stagesByRole: Record<CampaignAssignmentRole, string[]> = {
      [CampaignAssignmentRole.CAMPAIGN_MANAGER]: [
        "MANAGER_SCRIPT_REVIEW",
        "MANAGER_EDIT_REVIEW",
        "CLIENT_APPROVAL",
      ],
      [CampaignAssignmentRole.RELATIONSHIP_MANAGER]: [
        "MANAGER_SCRIPT_REVIEW",
        "MANAGER_EDIT_REVIEW",
        "CLIENT_APPROVAL",
      ],
      [CampaignAssignmentRole.WRITER]: ["WRITING"],
      [CampaignAssignmentRole.EDITOR]: ["EDITOR_INTAKE", "EDITING"],
      [CampaignAssignmentRole.DESIGNER]: [],
      [CampaignAssignmentRole.DOP]: ["SHOOT"],
      [CampaignAssignmentRole.SOCIAL_MEDIA_MANAGER]: ["SCHEDULED"],
      [CampaignAssignmentRole.CLIENT_APPROVER]: ["CLIENT_APPROVAL"],
      [CampaignAssignmentRole.AGENCY_APPROVER]: [
        "MANAGER_SCRIPT_REVIEW",
        "MANAGER_EDIT_REVIEW",
      ],
    };

    return stagesByRole[role] ?? [];
  }

  private defaultScope(actor: IdentityContext): CalendarScope {
    if (this.roleKeys(actor).some((role) => role === "OWNER")) return "AGENCY";
    if (this.roleKeys(actor).some((role) => role === "MANAGER"))
      return "MY_TEAM";
    return "MY_SCHEDULE";
  }

  private resolveScope(
    scope: CalendarScope,
    actor: IdentityContext,
  ): CalendarScope {
    if (this.allowedScopes(actor).includes(scope)) return scope;
    throw new ForbiddenException(
      `${this.labelize(scope)} is not available for your current role`,
    );
  }

  private allowedScopes(actor: IdentityContext): CalendarScope[] {
    if (this.isOwnerOrManager(actor)) {
      return ["MY_SCHEDULE", "MY_ROLE", "MY_TEAM", "CAMPAIGN", "AGENCY"];
    }

    return ["MY_SCHEDULE"];
  }

  private ensureAgencyScope(actor: IdentityContext) {
    if (!this.isOwnerOrManager(actor)) {
      throw new ForbiddenException(
        "Only owners and managers can view the agency calendar",
      );
    }
  }

  private ensureMemberFilterAccess(
    memberId: string | undefined,
    membershipId: string,
    actor: IdentityContext,
  ) {
    if (!memberId || memberId === membershipId) return;
    if (!this.isOwnerOrManager(actor)) {
      throw new ForbiddenException(
        "Only owners and managers can filter another member calendar",
      );
    }
  }

  private isOwnerOrManager(actor: IdentityContext) {
    return this.roleKeys(actor).some(
      (role) => role === "OWNER" || role === "MANAGER",
    );
  }

  private resolveRange(query: CalendarEventsQueryDto) {
    const now = new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.to
      ? new Date(query.to)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException("from cannot be after to");
    }
    return { from, to };
  }

  private taskEventType(stage?: string | null): CalendarEventType {
    if (!stage) return "WORKFLOW_TASK";
    if (stage === "SHOOT" || stage === "EDITOR_INTAKE") return "SHOOT";
    if (stage.includes("REVIEW")) return "REVIEW";
    if (stage === "CLIENT_APPROVAL") return "APPROVAL";
    return "WORKFLOW_TASK";
  }

  private taskRisk(status: TaskStatus, deadlineAt: Date) {
    if (status === TaskStatus.BLOCKED) return ContentRisk.BLOCKED;
    if (deadlineAt < new Date() && status !== TaskStatus.COMPLETED)
      return ContentRisk.OVERDUE;
    return ContentRisk.ON_TRACK;
  }

  private publishingRisk(status: PublishingStatus, scheduledAt: Date) {
    if (status === PublishingStatus.MISSED) return ContentRisk.OVERDUE;
    if (
      status === PublishingStatus.PUBLISHED ||
      status === PublishingStatus.CANCELLED
    )
      return ContentRisk.ON_TRACK;
    if (scheduledAt < new Date()) return ContentRisk.OVERDUE;
    return ContentRisk.ON_TRACK;
  }

  private workOrderRisk(status: WorkOrderStatus, dueAt: Date) {
    if (
      dueAt < new Date() &&
      !new Set<WorkOrderStatus>([
        WorkOrderStatus.COMPLETED,
        WorkOrderStatus.CANCELLED,
      ]).has(status)
    ) {
      return ContentRisk.OVERDUE;
    }
    return ContentRisk.ON_TRACK;
  }

  private roleKeys(actor: IdentityContext) {
    return [actor.role, ...(actor.roles ?? [])]
      .filter(Boolean)
      .map((role) => role!.toUpperCase());
  }

  private membershipRoleKeys(membership: { role?: any; roles?: any[] }) {
    const primary = membership.role?.systemRole?.key;
    const additional =
      membership.roles
        ?.map((item) => item.role?.systemRole?.key)
        .filter(Boolean) ?? [];
    return [...new Set([primary, ...additional].filter(Boolean))];
  }

  private csv(value?: string) {
    return (
      value
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? []
    );
  }

  private campaignIdFilter(
    requestedCampaignId: string | undefined,
    allowedCampaignIds: string[],
  ) {
    if (requestedCampaignId) {
      return {
        in: allowedCampaignIds.includes(requestedCampaignId)
          ? [requestedCampaignId]
          : [],
      };
    }
    return { in: allowedCampaignIds };
  }

  private enumValues<T extends Record<string, string>>(
    source: T,
    values: string[],
  ) {
    const allowed = new Set(Object.values(source));
    return values.filter((value): value is T[keyof T] => allowed.has(value));
  }

  private labelize(value: string) {
    return value
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }
}
