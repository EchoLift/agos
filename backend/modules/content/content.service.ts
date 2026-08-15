import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  CampaignAssignmentRole,
  ContentAssetStatus,
  ContentRisk,
  ContentStage,
  Prisma,
  TaskStatus,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { GoogleCalendarSyncService } from "@modules/google-calendar/google-calendar-sync.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CreateContentAssetDto } from "./dto/create-content-asset.dto";
import { UpdateContentPlanningDto } from "./dto/update-content-planning.dto";
import { UpdateContentAssetDto } from "./dto/update-content-asset.dto";

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Optional()
    private readonly googleCalendarSync?: GoogleCalendarSyncService,
  ) {}

  async create(
    dto: CreateContentAssetDto,
    agencyId?: string,
    actor?: IdentityContext | string,
  ) {
    const resolvedAgencyId = agencyId ?? dto.agencyId;
    if (!resolvedAgencyId) {
      throw new BadRequestException("Agency context is required");
    }
    const actorUserId = typeof actor === "string" ? actor : actor?.userId;
    const actorMembershipId =
      typeof actor === "string" ? undefined : actor?.membershipId;

    const [campaign, client] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: dto.campaignId },
        include: {
          teamAssignments: true,
          publishingSchedules: {
            where: { contentAssetId: null, status: { not: "CANCELLED" } },
            orderBy: { scheduledAt: "asc" },
            take: 1,
          },
        },
      }),
      this.prisma.client.findUnique({ where: { id: dto.clientId } }),
    ]);

    if (!campaign || campaign.agencyId !== resolvedAgencyId) {
      throw new ConflictException(
        "Campaign does not belong to the current agency",
      );
    }

    if (
      !client ||
      client.agencyId !== resolvedAgencyId ||
      client.id !== dto.clientId
    ) {
      throw new ConflictException(
        "Client does not belong to the current agency",
      );
    }

    if (campaign.clientId !== dto.clientId) {
      throw new ConflictException(
        "Campaign and client do not belong to the same agency context",
      );
    }

    const displayCode =
      dto.displayCode ?? this.generateDisplayCode(resolvedAgencyId, dto.type);
    const selectedAssigneeId = this.nullIfBlank(dto.assigneeId);
    const writerMembershipId = selectedAssigneeId
      ? this.ensureCampaignRoleOverride(
          campaign.teamAssignments,
          selectedAssigneeId,
          CampaignAssignmentRole.WRITER,
          "Selected owner must be assigned as Writer on this campaign",
        )
      : this.requiredSingleCampaignAssignee(
          campaign.teamAssignments,
          CampaignAssignmentRole.WRITER,
          "Writer required",
          "Multiple writers assigned; choose one on the campaign team or assign this content explicitly.",
        );
    const managerMembershipId =
      this.singleCampaignAssignee(
        campaign.teamAssignments,
        CampaignAssignmentRole.CAMPAIGN_MANAGER,
      ) ??
      this.singleCampaignAssignee(
        campaign.teamAssignments,
        CampaignAssignmentRole.RELATIONSHIP_MANAGER,
      ) ??
      actorMembershipId ??
      writerMembershipId;
    const writingDeadlineAt = dto.deadlineAt
      ? new Date(dto.deadlineAt)
      : this.defaultWritingDeadline(
          campaign.publishingSchedules[0]?.scheduledAt ?? campaign.endDate,
        );

    await Promise.all([
      this.ensureAssignableMembership(writerMembershipId, resolvedAgencyId),
      this.ensureAssignableMembership(managerMembershipId, resolvedAgencyId),
      actorMembershipId
        ? this.ensureAssignableMembership(actorMembershipId, resolvedAgencyId)
        : Promise.resolve(null),
    ]);

    const result = await this.prisma.$transaction(async (tx) => {
      const contentAsset = await tx.contentAsset.create({
        data: {
          agencyId: resolvedAgencyId,
          clientId: dto.clientId,
          campaignId: dto.campaignId,
          displayCode,
          type: dto.type,
          title: dto.title,
          brief: dto.brief,
          status: "ACTIVE",
        },
      });

      const workflowInstance = await tx.workflowInstance.create({
        data: {
          agencyId: resolvedAgencyId,
          contentAssetId: contentAsset.id,
          managerMembershipId,
          deadlineAt: writingDeadlineAt,
          riskStatus: ContentRisk.ON_TRACK,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      });

      const writingTask = await tx.workflowTask.create({
        data: {
          agencyId: resolvedAgencyId,
          workflowInstanceId: workflowInstance.id,
          displayName: `Write script for ${displayCode}`,
          ownerMembershipId: writerMembershipId,
          status: TaskStatus.TODO,
          deadlineAt: writingDeadlineAt,
        },
      });

      await tx.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          currentTaskId: writingTask.id,
          deadlineAt: writingDeadlineAt,
          version: { increment: 1 },
        },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId: resolvedAgencyId,
          workflowInstanceId: workflowInstance.id,
          fromStage: null,
          toStage: ContentStage.WRITING,
          changedById: actorMembershipId ?? managerMembershipId,
          reason: "Campaign content plan created writing work",
        },
      });

      await tx.assignmentHistory.create({
        data: {
          agencyId: resolvedAgencyId,
          workflowInstanceId: workflowInstance.id,
          workflowTaskId: writingTask.id,
          fromMembershipId: null,
          toMembershipId: writerMembershipId,
          changedByMembershipId: actorMembershipId ?? managerMembershipId,
          reason: "Inherited Writer from campaign team",
        },
      });

      return { contentAsset, workflowInstance, writingTask };
    });

    await this.eventBus.publish(DomainEvents.ContentAssetCreated, {
      agencyId: result.contentAsset.agencyId,
      actorId: actorUserId ?? null,
      payload: {
        contentAssetId: result.contentAsset.id,
        campaignId: result.contentAsset.campaignId,
        workflowInstanceId: result.workflowInstance.id,
        workflowTaskId: result.writingTask.id,
        displayCode: result.contentAsset.displayCode,
      },
    });

    await this.eventBus.publish(DomainEvents.ContentAssigned, {
      agencyId: result.contentAsset.agencyId,
      actorId: actorUserId ?? null,
      payload: {
        contentAssetId: result.contentAsset.id,
        campaignId: result.contentAsset.campaignId,
        workflowInstanceId: result.workflowInstance.id,
        workflowTaskId: result.writingTask.id,
        assigneeId: writerMembershipId,
        stage: ContentStage.WRITING,
        deadlineAt: writingDeadlineAt.toISOString(),
        inheritedFromCampaignRole: CampaignAssignmentRole.WRITER,
      },
    });

    this.queueWorkflowTaskSync(result.writingTask.id);
    return result.contentAsset;
  }

  async update(
    id: string,
    dto: UpdateContentAssetDto,
    agencyId: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.contentAsset.findUnique({
      where: { id },
    });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Content asset not found");
    }

    const contentAsset = await this.prisma.contentAsset.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.brief !== undefined ? { brief: dto.brief } : {}),
        ...(dto.displayCode ? { displayCode: dto.displayCode } : {}),
        ...(dto.type ? { type: dto.type } : {}),
      },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetUpdated, {
      agencyId,
      actorId: actorId ?? null,
      payload: {
        contentAssetId: contentAsset.id,
        displayCode: contentAsset.displayCode,
      },
    });

    return contentAsset;
  }

  async updatePlanning(
    id: string,
    dto: UpdateContentPlanningDto,
    agencyId: string,
    actor: IdentityContext,
  ) {
    if (!actor.membershipId) {
      throw new BadRequestException("Agency membership context is required");
    }

    const contentAsset = await this.prisma.contentAsset.findUnique({
      where: { id },
      include: {
        campaign: { include: { teamAssignments: true } },
      },
    });
    if (!contentAsset || contentAsset.agencyId !== agencyId) {
      throw new NotFoundException("Content asset not found");
    }

    const assigneeId = this.nullIfBlank(dto.assigneeId);
    const deadlineAt = dto.deadlineAt ? new Date(dto.deadlineAt) : null;
    if (!assigneeId && !deadlineAt) {
      throw new BadRequestException("Assignee or due date is required");
    }

    if (assigneeId) {
      await this.ensureAssignableMembership(assigneeId, agencyId);
    }
    await this.ensureAssignableMembership(actor.membershipId, agencyId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const workflowInstance = await this.ensurePlanningWorkflowInstance(
        tx,
        contentAsset,
        actor.membershipId!,
        assigneeId,
        deadlineAt,
      );
      const currentTask = workflowInstance.currentTaskId
        ? await tx.workflowTask.findUnique({
            where: { id: workflowInstance.currentTaskId },
          })
        : null;
      const nextDeadlineAt =
        deadlineAt ?? currentTask?.deadlineAt ?? workflowInstance.deadlineAt;

      const task = currentTask
        ? await tx.workflowTask.update({
            where: { id: currentTask.id },
            data: {
              ...(assigneeId !== undefined
                ? { ownerMembershipId: assigneeId }
                : {}),
              deadlineAt: nextDeadlineAt,
              version: { increment: 1 },
            },
          })
        : await tx.workflowTask.create({
            data: {
              agencyId,
              workflowInstanceId: workflowInstance.id,
              displayName: `Planning for ${contentAsset.displayCode}`,
              ownerMembershipId: assigneeId,
              status: TaskStatus.TODO,
              deadlineAt: nextDeadlineAt,
            },
          });

      await tx.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          currentTaskId: task.id,
          deadlineAt: nextDeadlineAt,
          version: { increment: 1 },
        },
      });

      if (assigneeId && assigneeId !== currentTask?.ownerMembershipId) {
        await tx.assignmentHistory.create({
          data: {
            agencyId,
            workflowInstanceId: workflowInstance.id,
            workflowTaskId: task.id,
            fromMembershipId: currentTask?.ownerMembershipId,
            toMembershipId: assigneeId,
            changedByMembershipId: actor.membershipId!,
            reason: "Assigned from campaign content plan",
          },
        });
      }

      const content = await tx.contentAsset.findUnique({
        where: { id },
        include: {
          client: true,
          campaign: true,
          workflowInstances: {
            orderBy: { startedAt: "desc" },
            take: 1,
            include: {
              currentStep: true,
              currentTask: {
                include: {
                  submissions: { orderBy: { createdAt: "desc" }, take: 1 },
                },
              },
              tasks: {
                include: {
                  submissions: { orderBy: { createdAt: "desc" }, take: 1 },
                },
              },
              transitions: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      });

      return {
        content,
        previousTaskId:
          currentTask && currentTask.id !== task.id ? currentTask.id : null,
        taskId: task.id,
      };
    });

    await this.eventBus.publish(DomainEvents.ContentAssigned, {
      agencyId,
      actorId: actor.userId,
      payload: {
        contentAssetId: id,
        assigneeId,
        deadlineAt: deadlineAt?.toISOString() ?? null,
      },
    });

    this.queueWorkflowTaskSync(updated.previousTaskId, updated.taskId);
    return this.withProjectedStage(updated.content!);
  }

  async findById(id: string, agencyId: string) {
    const contentAsset = await this.prisma.contentAsset.findUnique({
      where: { id },
      include: {
        client: true,
        campaign: true,
        workflowInstances: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            currentStep: true,
            currentTask: {
              include: {
                submissions: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
            tasks: {
              include: {
                submissions: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
            transitions: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!contentAsset || contentAsset.agencyId !== agencyId) {
      throw new NotFoundException("Content asset not found");
    }

    return this.withProjectedStage(contentAsset);
  }

  async findMany(agencyId: string, campaignId?: string) {
    const assets = await this.prisma.contentAsset.findMany({
      where: {
        agencyId,
        status: { not: "DELETED" },
        ...(campaignId ? { campaignId } : {}),
      },
      include: {
        client: true,
        campaign: true,
        workflowInstances: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            currentStep: true,
            transitions: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    return assets.map((asset) => this.withProjectedStage(asset));
  }

  async archive(id: string, agencyId: string, actorId?: string) {
    const existing = await this.prisma.contentAsset.findUnique({
      where: { id },
    });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Content asset not found");
    }

    const contentAsset = await this.prisma.contentAsset.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetArchived, {
      agencyId,
      actorId: actorId ?? null,
      payload: { contentAssetId: contentAsset.id },
    });

    return contentAsset;
  }

  async restore(id: string, agencyId: string, actorId?: string) {
    const existing = await this.prisma.contentAsset.findUnique({
      where: { id },
    });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Content asset not found");
    }

    const contentAsset = await this.prisma.contentAsset.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetRestored, {
      agencyId,
      actorId: actorId ?? null,
      payload: { contentAssetId: contentAsset.id },
    });

    return contentAsset;
  }

  private async ensureAssignableMembership(
    membershipId: string,
    agencyId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, agencyId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        "Membership must be active and belong to the current agency",
      );
    }

    return membership;
  }

  private async ensurePlanningWorkflowInstance(
    tx: Prisma.TransactionClient,
    contentAsset: {
      id: string;
      agencyId: string;
      displayCode: string;
      campaign: {
        endDate: Date;
        teamAssignments: Array<{
          membershipId: string;
          assignmentRole: CampaignAssignmentRole;
        }>;
      };
    },
    actorMembershipId: string,
    assigneeId?: string | null,
    deadlineAt?: Date | null,
  ) {
    const existing = await tx.workflowInstance.findFirst({
      where: {
        agencyId: contentAsset.agencyId,
        contentAssetId: contentAsset.id,
        status: WorkflowInstanceStatus.ACTIVE,
      },
    });

    if (existing) return existing;

    const managerMembershipId =
      contentAsset.campaign.teamAssignments.find(
        (assignment) =>
          assignment.assignmentRole === CampaignAssignmentRole.CAMPAIGN_MANAGER,
      )?.membershipId ??
      contentAsset.campaign.teamAssignments.find(
        (assignment) =>
          assignment.assignmentRole ===
          CampaignAssignmentRole.RELATIONSHIP_MANAGER,
      )?.membershipId ??
      actorMembershipId ??
      assigneeId;

    if (!managerMembershipId) {
      throw new BadRequestException(
        "Assign a campaign manager before planning workflow dates",
      );
    }

    const workflowInstance = await tx.workflowInstance.create({
      data: {
        agencyId: contentAsset.agencyId,
        contentAssetId: contentAsset.id,
        managerMembershipId,
        deadlineAt: deadlineAt ?? contentAsset.campaign.endDate,
        riskStatus: ContentRisk.ON_TRACK,
        status: WorkflowInstanceStatus.ACTIVE,
      },
    });

    await tx.workflowTransition.create({
      data: {
        agencyId: contentAsset.agencyId,
        workflowInstanceId: workflowInstance.id,
        fromStage: null,
        toStage: ContentStage.IDEA,
        changedById: actorMembershipId,
        reason: "Campaign content plan started workflow",
      },
    });

    return workflowInstance;
  }

  private nullIfBlank(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private requiredSingleCampaignAssignee(
    assignments: Array<{
      membershipId: string;
      assignmentRole: CampaignAssignmentRole;
    }>,
    assignmentRole: CampaignAssignmentRole,
    missingMessage: string,
    multipleMessage: string,
  ) {
    const matching = assignments.filter(
      (assignment) => assignment.assignmentRole === assignmentRole,
    );
    if (matching.length === 0) {
      throw new BadRequestException(missingMessage);
    }
    if (matching.length > 1) {
      throw new BadRequestException(multipleMessage);
    }
    return matching[0].membershipId;
  }

  private singleCampaignAssignee(
    assignments: Array<{
      membershipId: string;
      assignmentRole: CampaignAssignmentRole;
    }>,
    assignmentRole: CampaignAssignmentRole,
  ) {
    const matching = assignments.filter(
      (assignment) => assignment.assignmentRole === assignmentRole,
    );
    return matching.length === 1 ? matching[0].membershipId : null;
  }

  private ensureCampaignRoleOverride(
    assignments: Array<{
      membershipId: string;
      assignmentRole: CampaignAssignmentRole;
    }>,
    membershipId: string,
    assignmentRole: CampaignAssignmentRole,
    message: string,
  ) {
    const exists = assignments.some(
      (assignment) =>
        assignment.membershipId === membershipId &&
        assignment.assignmentRole === assignmentRole,
    );
    if (!exists) {
      throw new BadRequestException(message);
    }
    return membershipId;
  }

  private defaultWritingDeadline(anchor: Date) {
    const deadline = new Date(anchor);
    deadline.setDate(deadline.getDate() - 4);
    deadline.setHours(18, 0, 0, 0);

    if (deadline.getTime() < Date.now()) {
      return new Date(anchor);
    }

    return deadline;
  }

  private generateDisplayCode(agencyId: string, type: string) {
    const prefix = type.toUpperCase().slice(0, 4);
    return `${prefix}-${agencyId.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  }

  private withProjectedStage<
    T extends {
      status: ContentAssetStatus;
      client?: {
        id: string;
        name: string;
        displayName?: string | null;
        industry?: string | null;
        website?: string | null;
        businessDescription?: string | null;
        brandVoice?: string | null;
        brandPersonality?: string | null;
        tagline?: string | null;
        audience?: string | null;
        audienceLocations?: string | null;
        audiencePainPoints?: string | null;
        contentGoals?: string | null;
        instagramUrl?: string | null;
        youtubeUrl?: string | null;
        linkedinUrl?: string | null;
      } | null;
      campaign?: {
        id: string;
        name: string;
        status: string;
        campaignType?: string | null;
        goal?: string | null;
        keyMessage?: string | null;
        cta?: string | null;
      } | null;
      workflowInstances?: Array<{
        currentStep?: { stage: ContentStage } | null;
        currentTask?: {
          submissions?: Array<{
            id: string;
            submissionType: string;
            version: number;
            body?: string | null;
            externalLink?: string | null;
            status: string;
            createdAt: Date;
          }>;
        } | null;
        tasks?: Array<{
          submissions?: Array<{
            id: string;
            submissionType: string;
            version: number;
            body?: string | null;
            externalLink?: string | null;
            status: string;
            createdAt: Date;
          }>;
        }>;
        transitions?: Array<{ toStage: ContentStage | null }>;
      }>;
    },
  >(asset: T) {
    const workflow = asset.workflowInstances?.[0];
    const latestSubmission = this.latestWorkflowSubmission(workflow);
    const stage = this.projectContentStage(
      asset.status,
      workflow?.currentStep?.stage ??
        workflow?.transitions?.[0]?.toStage ??
        null,
    );
    const { workflowInstances, client, campaign, ...contentAsset } = asset;
    return {
      ...contentAsset,
      stage,
      ...(latestSubmission
        ? {
            latestSubmission: {
              id: latestSubmission.id,
              submissionType: latestSubmission.submissionType,
              version: latestSubmission.version,
              body: latestSubmission.body,
              externalLink: latestSubmission.externalLink,
              status: latestSubmission.status,
              createdAt: latestSubmission.createdAt,
            },
          }
        : {}),
      ...(client ? { clientSummary: this.clientWorkSummary(client) } : {}),
      ...(campaign
        ? {
            campaignSummary: {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              campaignType: campaign.campaignType,
              goal: campaign.goal,
              keyMessage: campaign.keyMessage,
              cta: campaign.cta,
            },
          }
        : {}),
    };
  }

  private latestWorkflowSubmission(workflow?: {
    currentTask?: {
      submissions?: Array<{
        id: string;
        submissionType: string;
        version: number;
        body?: string | null;
        externalLink?: string | null;
        status: string;
        createdAt: Date;
      }>;
    } | null;
    tasks?: Array<{
      submissions?: Array<{
        id: string;
        submissionType: string;
        version: number;
        body?: string | null;
        externalLink?: string | null;
        status: string;
        createdAt: Date;
      }>;
    }>;
  }) {
    const submissions = [
      ...(workflow?.currentTask?.submissions ?? []),
      ...(workflow?.tasks?.flatMap((task) => task.submissions ?? []) ?? []),
    ];

    return (
      submissions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null
    );
  }

  private projectContentStage(
    status: ContentAssetStatus,
    workflowStage: ContentStage | null,
  ) {
    if (
      status === ContentAssetStatus.PUBLISHED ||
      status === ContentAssetStatus.COMPLETED
    ) {
      return ContentStage.PUBLISHED;
    }

    if (
      status === ContentAssetStatus.ARCHIVED ||
      status === ContentAssetStatus.DELETED
    ) {
      return ContentStage.ARCHIVED;
    }

    return workflowStage ?? ContentStage.IDEA;
  }

  private clientWorkSummary(client: {
    id: string;
    name: string;
    displayName?: string | null;
    industry?: string | null;
    website?: string | null;
    businessDescription?: string | null;
    brandVoice?: string | null;
    brandPersonality?: string | null;
    tagline?: string | null;
    audience?: string | null;
    audienceLocations?: string | null;
    audiencePainPoints?: string | null;
    contentGoals?: string | null;
    instagramUrl?: string | null;
    youtubeUrl?: string | null;
    linkedinUrl?: string | null;
  }) {
    return {
      id: client.id,
      name: client.displayName || client.name,
      legalName: client.name,
      industry: client.industry,
      website: client.website,
      description: client.businessDescription,
      brandVoice: client.brandVoice,
      brandPersonality: client.brandPersonality,
      tagline: client.tagline,
      audience: client.audience,
      audienceLocations: client.audienceLocations,
      audiencePainPoints: client.audiencePainPoints,
      contentGoals: client.contentGoals,
      socialLinks: {
        instagram: client.instagramUrl,
        youtube: client.youtubeUrl,
        linkedin: client.linkedinUrl,
      },
    };
  }

  private queueWorkflowTaskSync(...taskIds: Array<string | null | undefined>) {
    if (!this.googleCalendarSync) return;
    for (const taskId of new Set(taskIds.filter(Boolean) as string[])) {
      this.googleCalendarSync.queueWorkflowTaskSync(taskId);
    }
  }
}
