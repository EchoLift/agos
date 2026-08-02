import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CampaignAssignmentRole,
  CampaignStatus,
  ContentAssetStatus,
  ContentRisk,
  ContentStage,
  ContentType,
  Prisma,
  PublishingSchedule,
  TaskStatus,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEventName, DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CampaignStatusActionDto } from "./dto/campaign-status-action.dto";
import {
  CreateCampaignTeamAssignmentDto,
  UpdateCampaignTeamAssignmentDto,
} from "./dto/campaign-team-assignment.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import {
  CancelPublishingScheduleDto,
  CreatePublishingScheduleDto,
  GeneratePublishingProductionDto,
  MarkPublishingSchedulePublishedDto,
  UpdatePublishingScheduleDto,
} from "./dto/publishing-schedule.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

const SINGLE_ASSIGNMENT_ROLES = new Set<CampaignAssignmentRole>([
  CampaignAssignmentRole.CAMPAIGN_MANAGER,
  CampaignAssignmentRole.RELATIONSHIP_MANAGER,
]);

const PUBLISHING_ACTIVITY_EVENTS = [
  DomainEvents.PublishingSlotCreated,
  DomainEvents.PublishingSlotUpdated,
  DomainEvents.PublishingSlotRescheduled,
  DomainEvents.PublishingSlotCancelled,
  DomainEvents.PublishingSlotPublished,
  DomainEvents.PublishingSlotMissed,
  DomainEvents.PublishingSlotProductionGenerated,
];

const CAMPAIGN_ACTIVITY_EVENTS = [
  DomainEvents.CampaignCreated,
  DomainEvents.CampaignUpdated,
  DomainEvents.CampaignActivated,
  DomainEvents.CampaignPaused,
  DomainEvents.CampaignResumed,
  DomainEvents.CampaignCompleted,
  DomainEvents.CampaignArchived,
  DomainEvents.CampaignRestored,
  DomainEvents.CampaignTeamMemberAssigned,
  DomainEvents.CampaignTeamMemberRemoved,
  DomainEvents.CampaignManagerChanged,
  ...PUBLISHING_ACTIVITY_EVENTS,
];

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateCampaignDto, agencyId?: string, actorId?: string) {
    const resolvedAgencyId = agencyId ?? dto.agencyId;
    if (!resolvedAgencyId) {
      throw new BadRequestException("Agency context is required");
    }

    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client || client.agencyId !== resolvedAgencyId) {
      throw new ConflictException(
        "Client does not belong to the current agency",
      );
    }

    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException("startDate cannot be after endDate");
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        agencyId: resolvedAgencyId,
        clientId: dto.clientId,
        name: dto.name,
        campaignCode: await this.generateCampaignCode(resolvedAgencyId),
        objectives: dto.objective,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: "DRAFT",
        createdByMembershipId: actorId ?? dto.actorId ?? "",
        ...this.optionalCampaignData(dto),
        ...(dto.deliverablePlans?.length
          ? {
              deliverablePlans: {
                create: dto.deliverablePlans.map((plan) =>
                  this.toDeliverablePlanCreate(resolvedAgencyId, plan),
                ),
              },
            }
          : {}),
        ...(dto.publishingSchedules?.length
          ? {
              publishingSchedules: {
                create: dto.publishingSchedules.map((schedule) =>
                  this.toPublishingScheduleCreate(
                    resolvedAgencyId,
                    dto,
                    schedule,
                  ),
                ),
              },
            }
          : {}),
        ...(dto.assignedMembershipIds?.length
          ? {
              assignedMemberships: {
                connect: dto.assignedMembershipIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: this.campaignInclude(),
    });

    await this.eventBus.publish(DomainEvents.CampaignCreated, {
      agencyId: campaign.agencyId,
      actorId: actorId ?? dto.actorId ?? null,
      aggregateId: campaign.id,
      aggregateType: "Campaign",
      payload: {
        campaignId: campaign.id,
        clientId: campaign.clientId,
        name: campaign.name,
      },
    });

    return campaign;
  }

  async update(
    id: string,
    dto: UpdateCampaignDto,
    agencyId: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Campaign not found");
    }

    if (
      dto.startDate &&
      dto.endDate &&
      new Date(dto.startDate) > new Date(dto.endDate)
    ) {
      throw new BadRequestException("startDate cannot be after endDate");
    }

    try {
      const campaign = await this.prisma.$transaction(async (tx) => {
        if (dto.deliverablePlans) {
          await tx.campaignDeliverablePlan.deleteMany({
            where: { campaignId: id, agencyId },
          });
        }
        if (dto.publishingSchedules) {
          await tx.publishingSchedule.deleteMany({
            where: { campaignId: id, agencyId, contentAssetId: null },
          });
        }

        return tx.campaign.update({
          where: {
            id,
            version: dto.version ?? existing.version,
          },
          data: {
            ...(dto.name ? { name: dto.name } : {}),
            ...(dto.objective !== undefined
              ? { objectives: dto.objective }
              : {}),
            ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
            ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
            ...this.optionalCampaignData(dto),
            ...(dto.deliverablePlans
              ? {
                  deliverablePlans: {
                    create: dto.deliverablePlans.map((plan) =>
                      this.toDeliverablePlanCreate(agencyId, plan),
                    ),
                  },
                }
              : {}),
            ...(dto.publishingSchedules
              ? {
                  publishingSchedules: {
                    create: dto.publishingSchedules.map((schedule) =>
                      this.toPublishingScheduleCreate(agencyId, dto, schedule),
                    ),
                  },
                }
              : {}),
            version: { increment: 1 },
          },
          include: this.campaignInclude(),
        });
      });

      await this.eventBus.publish(DomainEvents.CampaignUpdated, {
        agencyId,
        actorId: actorId ?? null,
        aggregateId: campaign.id,
        aggregateType: "Campaign",
        payload: { campaignId: campaign.id, name: campaign.name },
      });

      return campaign;
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException("Campaign was modified by another user");
      }
      throw error;
    }
  }

  async findById(id: string, agencyId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: this.campaignInclude(),
    });
    if (!campaign || campaign.agencyId !== agencyId) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  async findMany(agencyId: string) {
    return this.prisma.campaign.findMany({
      where: { agencyId, status: { not: "DELETED" } },
      include: this.campaignInclude(),
      orderBy: { updatedAt: "desc" },
    });
  }

  async getTeam(id: string, agencyId: string) {
    await this.ensureCampaign(id, agencyId);

    return this.prisma.campaignTeamAssignment.findMany({
      where: { agencyId, campaignId: id },
      include: this.teamAssignmentInclude(),
      orderBy: [{ assignmentRole: "asc" }, { createdAt: "asc" }],
    });
  }

  async getActivity(id: string, agencyId: string) {
    await this.ensureCampaign(id, agencyId);

    const events = await this.prisma.outboxEvent.findMany({
      where: {
        agencyId,
        eventType: { in: CAMPAIGN_ACTIVITY_EVENTS },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const campaignEvents = events
      .map((event) => this.normalizeOutboxEvent(event))
      .filter(
        (event) => event.payload?.campaignId === id || event.aggregateId === id,
      );

    const actorIds = [
      ...new Set(
        campaignEvents
          .map((event) => event.actorId)
          .filter(Boolean) as string[],
      ),
    ];
    const membershipIds = [
      ...new Set(
        campaignEvents
          .map((event) => event.payload?.membershipId)
          .filter(Boolean) as string[],
      ),
    ];

    const [actors, memberships] = await Promise.all([
      actorIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      membershipIds.length
        ? this.prisma.membership.findMany({
            where: { id: { in: membershipIds } },
            include: { user: true, role: { include: { systemRole: true } } },
          })
        : Promise.resolve([]),
    ]);

    const actorNames = new Map(
      actors.map((actor) => [actor.id, actor.name ?? "Someone"]),
    );
    const membershipNames = new Map(
      memberships.map((membership) => [
        membership.id,
        membership.user.name ?? membership.role.displayName ?? "Team member",
      ]),
    );

    return {
      items: campaignEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        actor: event.actorId
          ? {
              id: event.actorId,
              name: actorNames.get(event.actorId) ?? "Someone",
            }
          : null,
        message: this.formatActivityMessage(event, membershipNames),
        metadata: event.payload,
      })),
    };
  }

  async getPublishingSchedules(id: string, actor: IdentityContext) {
    const agencyId = actor.agencyId ?? "";
    await this.ensureCampaign(id, agencyId);
    await this.syncMissedPublishingSlots(id, agencyId, actor.userId);

    const slots = await this.prisma.publishingSchedule.findMany({
      where: { agencyId, campaignId: id },
      include: this.publishingScheduleInclude(),
      orderBy: { scheduledAt: "asc" },
    });

    return {
      summary: this.buildPublishingSummary(slots),
      items: slots.map((slot) => this.toPublishingScheduleView(slot)),
    };
  }

  async createPublishingSchedule(
    id: string,
    dto: CreatePublishingScheduleDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensurePublishingManager(actor);
    const campaign = await this.ensureCampaign(id, agencyId);
    const scheduledAt = new Date(dto.scheduledAt);
    this.ensureWithinCampaignWindow(scheduledAt, campaign);
    if (dto.contentAssetId)
      await this.ensureCampaignContentAsset(dto.contentAssetId, id, agencyId);

    const slot = await this.prisma.publishingSchedule.create({
      data: {
        agencyId,
        campaignId: id,
        contentAssetId: dto.contentAssetId,
        platform: dto.platform,
        scheduledAt,
        timezone:
          this.nullIfBlank(dto.timezone) ?? campaign.timezone ?? "Asia/Kolkata",
        caption: this.nullIfBlank(dto.caption),
        note: this.nullIfBlank(dto.note),
        status: "PLANNED",
      },
      include: this.publishingScheduleInclude(),
    });

    await this.publishPublishingEvent(
      DomainEvents.PublishingSlotCreated,
      agencyId,
      actor.userId,
      id,
      slot,
    );
    return this.toPublishingScheduleView(slot);
  }

  async updatePublishingSchedule(
    id: string,
    scheduleId: string,
    dto: UpdatePublishingScheduleDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensurePublishingManager(actor);
    const campaign = await this.ensureCampaign(id, agencyId);
    const existing = await this.ensurePublishingSlot(scheduleId, id, agencyId);

    if (existing.status === "CANCELLED") {
      throw new BadRequestException(
        "Cancelled publishing slots cannot be edited",
      );
    }
    if (existing.status === "PUBLISHED") {
      throw new BadRequestException(
        "Published publishing slots cannot be edited",
      );
    }

    const nextScheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : existing.scheduledAt;
    this.ensureWithinCampaignWindow(nextScheduledAt, campaign);
    if (dto.contentAssetId)
      await this.ensureCampaignContentAsset(dto.contentAssetId, id, agencyId);

    try {
      const slot = await this.prisma.publishingSchedule.update({
        where: { id: scheduleId, version: dto.version },
        data: {
          ...(dto.platform ? { platform: dto.platform } : {}),
          ...(dto.scheduledAt ? { scheduledAt: nextScheduledAt } : {}),
          ...(dto.timezone !== undefined
            ? {
                timezone:
                  this.nullIfBlank(dto.timezone) ??
                  campaign.timezone ??
                  "Asia/Kolkata",
              }
            : {}),
          ...(dto.contentAssetId !== undefined
            ? { contentAssetId: this.nullIfBlank(dto.contentAssetId) }
            : {}),
          ...(dto.caption !== undefined
            ? { caption: this.nullIfBlank(dto.caption) }
            : {}),
          ...(dto.note !== undefined
            ? { note: this.nullIfBlank(dto.note) }
            : {}),
          version: { increment: 1 },
        },
        include: this.publishingScheduleInclude(),
      });

      await this.publishPublishingEvent(
        dto.scheduledAt &&
          nextScheduledAt.getTime() !== existing.scheduledAt.getTime()
          ? DomainEvents.PublishingSlotRescheduled
          : DomainEvents.PublishingSlotUpdated,
        agencyId,
        actor.userId,
        id,
        slot,
        { previousScheduledAt: existing.scheduledAt.toISOString() },
      );

      return this.toPublishingScheduleView(slot);
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException(
          "Publishing slot was modified by another user",
        );
      }
      throw error;
    }
  }

  async cancelPublishingSchedule(
    id: string,
    scheduleId: string,
    dto: CancelPublishingScheduleDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensurePublishingManager(actor);
    await this.ensureCampaign(id, agencyId);
    const existing = await this.ensurePublishingSlot(scheduleId, id, agencyId);

    if (existing.status === "PUBLISHED") {
      throw new BadRequestException(
        "Published publishing slots cannot be cancelled",
      );
    }
    if (existing.status === "CANCELLED") {
      return this.toPublishingScheduleView(
        await this.getPublishingSlotView(scheduleId, id, agencyId),
      );
    }

    try {
      const slot = await this.prisma.publishingSchedule.update({
        where: { id: scheduleId, version: dto.version },
        data: {
          status: "CANCELLED",
          cancellationReason: dto.cancellationReason,
          version: { increment: 1 },
        },
        include: this.publishingScheduleInclude(),
      });

      await this.publishPublishingEvent(
        DomainEvents.PublishingSlotCancelled,
        agencyId,
        actor.userId,
        id,
        slot,
        {
          cancellationReason: dto.cancellationReason,
        },
      );

      return this.toPublishingScheduleView(slot);
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException(
          "Publishing slot was modified by another user",
        );
      }
      throw error;
    }
  }

  async markPublishingSchedulePublished(
    id: string,
    scheduleId: string,
    dto: MarkPublishingSchedulePublishedDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensurePublishingManager(actor);
    await this.ensureCampaign(id, agencyId);
    const existing = await this.ensurePublishingSlot(scheduleId, id, agencyId);

    if (existing.status === "CANCELLED") {
      throw new BadRequestException(
        "Cancelled publishing slots cannot be marked published",
      );
    }

    try {
      const slot = await this.prisma.$transaction(async (tx) => {
        const publishedSlot = await tx.publishingSchedule.update({
          where: { id: scheduleId, version: dto.version },
          data: {
            status: "PUBLISHED",
            riskStatus: "ON_TRACK",
            publishedUrl: dto.publishedUrl,
            publishedAt: dto.publishedAt
              ? new Date(dto.publishedAt)
              : new Date(),
            version: { increment: 1 },
          },
          include: this.publishingScheduleInclude(),
        });

        let workflowInstanceId: string | null = null;

        if (publishedSlot.contentAssetId) {
          await tx.contentAsset.update({
            where: { id: publishedSlot.contentAssetId },
            data: {
              status: "PUBLISHED",
              version: { increment: 1 },
            },
          });

          const workflowInstance = await tx.workflowInstance.findFirst({
            where: {
              agencyId,
              contentAssetId: publishedSlot.contentAssetId,
              status: WorkflowInstanceStatus.ACTIVE,
            },
            include: { currentStep: true },
            orderBy: { startedAt: "desc" },
          });

          if (workflowInstance) {
            workflowInstanceId = workflowInstance.id;

            await tx.workflowInstance.update({
              where: { id: workflowInstance.id },
              data: {
                status: WorkflowInstanceStatus.COMPLETED,
                completedAt: new Date(),
                riskStatus: "ON_TRACK",
                version: { increment: 1 },
              },
            });

            if (actor.membershipId) {
              await tx.workflowTransition.create({
                data: {
                  agencyId,
                  workflowInstanceId: workflowInstance.id,
                  fromStepId: workflowInstance.currentStepId,
                  fromStage: workflowInstance.currentStep?.stage ?? null,
                  toStage: ContentStage.PUBLISHED,
                  changedById: actor.membershipId,
                  reason: "Content published from campaign calendar",
                },
              });
            }
          }

          await this.eventBus.publishWithinTransaction(
            tx,
            DomainEvents.ContentAssetPublished,
            {
              agencyId,
              actorId: actor.userId,
              aggregateId: publishedSlot.contentAssetId,
              aggregateType: "ContentAsset",
              payload: {
                campaignId: id,
                contentAssetId: publishedSlot.contentAssetId,
                publishingScheduleId: publishedSlot.id,
                publishedUrl: dto.publishedUrl,
              },
            },
          );
        }

        await this.eventBus.publishWithinTransaction(
          tx,
          DomainEvents.PublishingSlotPublished,
          {
            agencyId,
            actorId: actor.userId,
            aggregateId: id,
            aggregateType: "Campaign",
            payload: {
              campaignId: id,
              publishingScheduleId: publishedSlot.id,
              contentAssetId: publishedSlot.contentAssetId,
              workflowInstanceId,
              platform: publishedSlot.platform,
              scheduledAt: publishedSlot.scheduledAt.toISOString(),
              status: publishedSlot.status,
            },
          },
        );

        return publishedSlot;
      });

      return this.toPublishingScheduleView(slot);
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException(
          "Publishing slot was modified by another user",
        );
      }
      throw error;
    }
  }

  async generatePublishingProduction(
    id: string,
    scheduleId: string,
    dto: GeneratePublishingProductionDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    const actorMembershipId = actor.membershipId;
    if (!actorMembershipId) {
      throw new BadRequestException("Membership context is required");
    }

    this.ensureCampaignManager(actor);
    const campaign = await this.ensureCampaign(id, agencyId);
    const slot = await this.ensurePublishingSlot(scheduleId, id, agencyId);

    if (slot.status === "CANCELLED") {
      throw new BadRequestException(
        "Cancelled publishing slots cannot generate production work",
      );
    }
    if (slot.contentAssetId) {
      return this.toPublishingScheduleView(
        await this.getPublishingSlotView(scheduleId, id, agencyId),
      );
    }

    const managerMembershipId =
      dto.managerMembershipId ??
      (await this.findCampaignAssignmentMembershipId(
        id,
        agencyId,
        CampaignAssignmentRole.CAMPAIGN_MANAGER,
      )) ??
      actorMembershipId;
    const writerMembershipId =
      dto.writerMembershipId ??
      (await this.findCampaignAssignmentMembershipId(
        id,
        agencyId,
        CampaignAssignmentRole.WRITER,
      ));

    if (!writerMembershipId) {
      throw new BadRequestException(
        "Assign a campaign writer before generating production work",
      );
    }

    await this.ensureAssignableMembership(managerMembershipId, agencyId);
    await this.ensureAssignableMembership(writerMembershipId, agencyId);

    const generatedSlot = await this.prisma.$transaction(async (tx) => {
      const displayCode = await this.generateContentDisplayCode(
        tx,
        agencyId,
        dto.contentType,
      );
      const scriptDueAt = dto.scriptDueAt
        ? new Date(dto.scriptDueAt)
        : this.defaultScriptDueAt(slot.scheduledAt);

      if (scriptDueAt > slot.scheduledAt) {
        throw new BadRequestException(
          "Script due date cannot be after the publishing date",
        );
      }

      const asset = await tx.contentAsset.create({
        data: {
          agencyId,
          clientId: campaign.clientId,
          campaignId: id,
          displayCode,
          type: dto.contentType,
          title: dto.title,
          brief:
            this.nullIfBlank(dto.brief) ??
            slot.note ??
            `${this.formatContentType(dto.contentType)} for ${campaign.name}`,
          status: ContentAssetStatus.ACTIVE,
        },
      });

      const workflowInstance = await tx.workflowInstance.create({
        data: {
          agencyId,
          contentAssetId: asset.id,
          managerMembershipId,
          deadlineAt: slot.scheduledAt,
          riskStatus: ContentRisk.ON_TRACK,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      });

      const writingTask = await tx.workflowTask.create({
        data: {
          agencyId,
          workflowInstanceId: workflowInstance.id,
          displayName: `Write script for ${displayCode}`,
          ownerMembershipId: writerMembershipId,
          status: TaskStatus.TODO,
          deadlineAt: scriptDueAt,
        },
      });

      await tx.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          currentTaskId: writingTask.id,
          deadlineAt: scriptDueAt,
          version: { increment: 1 },
        },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId,
          workflowInstanceId: workflowInstance.id,
          fromStage: null,
          toStage: ContentStage.WRITING,
          changedById: actorMembershipId,
          reason: "Production generated from publishing slot",
        },
      });

      await tx.assignmentHistory.create({
        data: {
          agencyId,
          workflowInstanceId: workflowInstance.id,
          workflowTaskId: writingTask.id,
          fromMembershipId: null,
          toMembershipId: writerMembershipId,
          changedByMembershipId: actorMembershipId,
          reason: "Writing task generated from publishing slot",
        },
      });

      const updatedSlot = await tx.publishingSchedule.update({
        where: { id: scheduleId },
        data: {
          contentAssetId: asset.id,
          status: "PLANNED",
          version: { increment: 1 },
        },
        include: this.publishingScheduleInclude(),
      });

      await this.createTaskNotification(tx, agencyId, writerMembershipId, {
        title: `Script assigned: ${displayCode}`,
        body: `${campaign.name} needs script work by ${scriptDueAt.toISOString()}`,
        eventType: DomainEvents.ContentAssigned,
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.ContentAssetCreated,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: asset.id,
          aggregateType: "ContentAsset",
          payload: {
            campaignId: id,
            contentAssetId: asset.id,
            publishingScheduleId: scheduleId,
            workflowInstanceId: workflowInstance.id,
            workflowTaskId: writingTask.id,
            displayCode,
          },
        },
      );

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.ContentAssigned,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: asset.id,
          aggregateType: "WorkflowTask",
          payload: {
            campaignId: id,
            contentAssetId: asset.id,
            publishingScheduleId: scheduleId,
            workflowInstanceId: workflowInstance.id,
            workflowTaskId: writingTask.id,
            assigneeId: writerMembershipId,
            stage: ContentStage.WRITING,
            deadlineAt: scriptDueAt.toISOString(),
          },
        },
      );

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.PublishingSlotProductionGenerated,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: id,
          aggregateType: "Campaign",
          payload: {
            campaignId: id,
            publishingScheduleId: scheduleId,
            contentAssetId: asset.id,
            workflowInstanceId: workflowInstance.id,
            workflowTaskId: writingTask.id,
            platform: updatedSlot.platform,
            scheduledAt: updatedSlot.scheduledAt.toISOString(),
          },
        },
      );

      return updatedSlot;
    });

    return this.toPublishingScheduleView(generatedSlot);
  }

  async assignTeamMember(
    id: string,
    dto: CreateCampaignTeamAssignmentDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    await this.ensureCampaign(id, agencyId);
    await this.ensureCampaignTeamManager(id, agencyId, actor);
    await this.ensureAssignableMembership(dto.membershipId, agencyId);
    await this.ensureSingleAssignmentSlot(id, agencyId, dto.assignmentRole);

    try {
      const assignment = await this.prisma.campaignTeamAssignment.create({
        data: {
          agencyId,
          campaignId: id,
          membershipId: dto.membershipId,
          assignmentRole: dto.assignmentRole,
        },
        include: this.teamAssignmentInclude(),
      });

      await this.eventBus.publish(
        dto.assignmentRole === CampaignAssignmentRole.CAMPAIGN_MANAGER
          ? DomainEvents.CampaignManagerChanged
          : DomainEvents.CampaignTeamMemberAssigned,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: id,
          aggregateType: "Campaign",
          payload: {
            campaignId: id,
            assignmentId: assignment.id,
            membershipId: assignment.membershipId,
            assignmentRole: assignment.assignmentRole,
          },
        },
      );

      return assignment;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ConflictException(
          "This member already has that campaign responsibility",
        );
      }
      throw error;
    }
  }

  async updateTeamAssignment(
    id: string,
    assignmentId: string,
    dto: UpdateCampaignTeamAssignmentDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    await this.ensureCampaign(id, agencyId);
    await this.ensureCampaignTeamManager(id, agencyId, actor);

    const existing = await this.prisma.campaignTeamAssignment.findFirst({
      where: { id: assignmentId, campaignId: id, agencyId },
    });
    if (!existing) {
      throw new NotFoundException("Campaign team assignment not found");
    }

    const nextRole = dto.assignmentRole ?? existing.assignmentRole;
    const nextMembershipId = dto.membershipId ?? existing.membershipId;
    await this.ensureAssignableMembership(nextMembershipId, agencyId);
    await this.ensureSingleAssignmentSlot(id, agencyId, nextRole, assignmentId);

    try {
      const assignment = await this.prisma.campaignTeamAssignment.update({
        where: { id: assignmentId, version: dto.version },
        data: {
          membershipId: nextMembershipId,
          assignmentRole: nextRole,
          version: { increment: 1 },
        },
        include: this.teamAssignmentInclude(),
      });

      await this.eventBus.publish(
        nextRole === CampaignAssignmentRole.CAMPAIGN_MANAGER
          ? DomainEvents.CampaignManagerChanged
          : DomainEvents.CampaignTeamMemberAssigned,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: id,
          aggregateType: "Campaign",
          payload: {
            campaignId: id,
            assignmentId: assignment.id,
            membershipId: assignment.membershipId,
            assignmentRole: assignment.assignmentRole,
          },
        },
      );

      return assignment;
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException(
          "Campaign team assignment was modified by another user",
        );
      }
      if (error?.code === "P2002") {
        throw new ConflictException(
          "This member already has that campaign responsibility",
        );
      }
      throw error;
    }
  }

  async removeTeamAssignment(
    id: string,
    assignmentId: string,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    await this.ensureCampaign(id, agencyId);
    await this.ensureCampaignTeamManager(id, agencyId, actor);

    const assignment = await this.prisma.campaignTeamAssignment.findFirst({
      where: { id: assignmentId, campaignId: id, agencyId },
    });
    if (!assignment) {
      throw new NotFoundException("Campaign team assignment not found");
    }

    await this.prisma.campaignTeamAssignment.delete({
      where: { id: assignmentId },
    });

    await this.eventBus.publish(DomainEvents.CampaignTeamMemberRemoved, {
      agencyId,
      actorId: actor.userId,
      aggregateId: id,
      aggregateType: "Campaign",
      payload: {
        campaignId: id,
        assignmentId,
        membershipId: assignment.membershipId,
        assignmentRole: assignment.assignmentRole,
      },
    });

    return { success: true };
  }

  async archive(
    id: string,
    dto: CampaignStatusActionDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensureCampaignManager(actor);
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Campaign not found");
    }

    if (!["ACTIVE", "PAUSED", "COMPLETED"].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot archive campaign from ${existing.status}`,
      );
    }

    try {
      const campaign = await this.prisma.campaign.update({
        where: { id, version: dto.version ?? existing.version },
        data: { status: "ARCHIVED", version: { increment: 1 } },
      });

      await this.eventBus.publish(DomainEvents.CampaignArchived, {
        agencyId,
        actorId: actor.userId,
        aggregateId: campaign.id,
        aggregateType: "Campaign",
        payload: {
          campaignId: campaign.id,
          previousStatus: existing.status,
          status: campaign.status,
        },
      });

      return campaign;
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException("Campaign was modified by another user");
      }
      throw error;
    }
  }

  async activate(
    id: string,
    dto: CampaignStatusActionDto,
    actorOrAgencyId: IdentityContext | string,
    actorId?: string,
  ) {
    const actor = typeof actorOrAgencyId === "string" ? null : actorOrAgencyId;
    const agencyId =
      typeof actorOrAgencyId === "string"
        ? actorOrAgencyId
        : (actorOrAgencyId.agencyId ?? "");
    if (actor) this.ensureCampaignManager(actor);
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (
      !existing ||
      existing.agencyId !== agencyId ||
      existing.status === "DELETED"
    ) {
      throw new NotFoundException("Campaign not found");
    }

    if (existing.status === "ACTIVE") {
      return existing;
    }

    if (!["DRAFT", "PAUSED", "ARCHIVED"].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot activate campaign from ${existing.status}`,
      );
    }

    try {
      const campaign = await this.prisma.campaign.update({
        where: {
          id,
          version: dto.version ?? existing.version,
        },
        data: {
          status: "ACTIVE",
          version: { increment: 1 },
        },
      });

      await this.eventBus.publish(DomainEvents.CampaignActivated, {
        agencyId,
        actorId: actor?.userId ?? actorId ?? null,
        aggregateId: campaign.id,
        aggregateType: "Campaign",
        payload: {
          campaignId: campaign.id,
          previousStatus: existing.status,
          status: campaign.status,
        },
      });

      return campaign;
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException("Campaign was modified by another user");
      }
      throw error;
    }
  }

  async pause(
    id: string,
    dto: CampaignStatusActionDto,
    actor: IdentityContext,
  ) {
    return this.changeStatus(id, dto, actor, {
      allowedFrom: ["ACTIVE"],
      nextStatus: "PAUSED",
      eventName: DomainEvents.CampaignPaused,
    });
  }

  async resume(
    id: string,
    dto: CampaignStatusActionDto,
    actor: IdentityContext,
  ) {
    return this.changeStatus(id, dto, actor, {
      allowedFrom: ["PAUSED"],
      nextStatus: "ACTIVE",
      eventName: DomainEvents.CampaignResumed,
    });
  }

  async complete(
    id: string,
    dto: CampaignStatusActionDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    await this.ensureCampaign(id, agencyId);
    await this.ensureCampaignCanComplete(id, agencyId);
    return this.changeStatus(id, dto, actor, {
      allowedFrom: ["ACTIVE"],
      nextStatus: "COMPLETED",
      eventName: DomainEvents.CampaignCompleted,
    });
  }

  async restore(
    id: string,
    dto: CampaignStatusActionDto,
    actor: IdentityContext,
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensureCampaignManager(actor);
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Campaign not found");
    }

    if (existing.status !== "ARCHIVED") {
      throw new BadRequestException(
        `Cannot restore campaign from ${existing.status}`,
      );
    }

    try {
      const campaign = await this.prisma.campaign.update({
        where: { id, version: dto.version ?? existing.version },
        data: { status: "ACTIVE", version: { increment: 1 } },
      });

      await this.eventBus.publish(DomainEvents.CampaignRestored, {
        agencyId,
        actorId: actor.userId,
        aggregateId: campaign.id,
        aggregateType: "Campaign",
        payload: {
          campaignId: campaign.id,
          previousStatus: existing.status,
          status: campaign.status,
        },
      });

      return campaign;
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException("Campaign was modified by another user");
      }
      throw error;
    }
  }

  private async changeStatus(
    id: string,
    dto: CampaignStatusActionDto,
    actor: IdentityContext,
    config: {
      allowedFrom: CampaignStatus[];
      nextStatus: CampaignStatus;
      eventName: DomainEventName;
    },
  ) {
    const agencyId = actor.agencyId ?? "";
    this.ensureCampaignManager(actor);
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (
      !existing ||
      existing.agencyId !== agencyId ||
      existing.status === "DELETED"
    ) {
      throw new NotFoundException("Campaign not found");
    }

    if (!config.allowedFrom.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot move campaign from ${existing.status} to ${config.nextStatus}`,
      );
    }

    try {
      const campaign = await this.prisma.campaign.update({
        where: {
          id,
          version: dto.version ?? existing.version,
        },
        data: {
          status: config.nextStatus,
          version: { increment: 1 },
        },
      });

      await this.eventBus.publish(config.eventName, {
        agencyId,
        actorId: actor.userId,
        aggregateId: campaign.id,
        aggregateType: "Campaign",
        payload: {
          campaignId: campaign.id,
          previousStatus: existing.status,
          status: campaign.status,
        },
      });

      return campaign;
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ConflictException("Campaign was modified by another user");
      }
      throw error;
    }
  }

  private optionalCampaignData(
    dto: Partial<CreateCampaignDto>,
  ): Record<string, string | Date | boolean | null | undefined> {
    const textFields: Array<keyof CreateCampaignDto> = [
      "campaignType",
      "priority",
      "goal",
      "primaryKpi",
      "targetAudience",
      "keyMessage",
      "cta",
      "reviewFrequency",
      "workingDays",
      "timezone",
      "workflowTemplate",
      "clientApprover",
      "agencyApproverMembershipId",
      "approvalSla",
      "revisionLimit",
      "references",
      "moodBoardUrl",
      "driveFolderUrl",
      "internalNotes",
      "postingDays",
      "postingWindows",
      "blackoutDates",
      "platformMix",
    ];

    const data: Record<string, string | Date | boolean | null | undefined> = {};

    textFields.forEach((field) => {
      if (dto[field] !== undefined) {
        data[field] = this.nullIfBlank(dto[field] as string | null | undefined);
      }
    });

    if (dto.useClientAudience !== undefined)
      data.useClientAudience = dto.useClientAudience;
    if (dto.autoGenerateCalendar !== undefined)
      data.autoGenerateCalendar = dto.autoGenerateCalendar;
    if (dto.launchDate !== undefined) {
      const normalized = this.nullIfBlank(dto.launchDate);
      data.launchDate = normalized ? new Date(normalized) : null;
    }

    return data;
  }

  private toDeliverablePlanCreate(
    agencyId: string,
    plan: NonNullable<CreateCampaignDto["deliverablePlans"]>[number],
  ) {
    return {
      agencyId,
      contentType: plan.contentType,
      quantity: plan.quantity,
      frequency: this.nullIfBlank(plan.frequency),
      preferredDays: this.nullIfBlank(plan.preferredDays),
      preferredTime: this.nullIfBlank(plan.preferredTime),
      platform: this.nullIfBlank(plan.platform),
      startDate: plan.startDate ? new Date(plan.startDate) : null,
      endDate: plan.endDate ? new Date(plan.endDate) : null,
    };
  }

  private toPublishingScheduleCreate(
    agencyId: string,
    campaign: Pick<CreateCampaignDto, "timezone">,
    schedule: NonNullable<CreateCampaignDto["publishingSchedules"]>[number],
  ) {
    return {
      agencyId,
      platform: schedule.platform,
      scheduledAt: new Date(schedule.scheduledAt),
      timezone:
        this.nullIfBlank(schedule.timezone) ??
        this.nullIfBlank(campaign.timezone) ??
        "Asia/Kolkata",
    };
  }

  private campaignInclude() {
    return {
      client: true,
      deliverablePlans: true,
      publishingSchedules: { orderBy: { scheduledAt: "asc" as const } },
      assignedMemberships: {
        include: {
          user: true,
          role: true,
          roles: { include: { role: { include: { systemRole: true } } } },
        },
      },
      teamAssignments: {
        include: this.teamAssignmentInclude(),
        orderBy: [
          { assignmentRole: "asc" as const },
          { createdAt: "asc" as const },
        ],
      },
      agencyApprover: { include: { user: true, role: true } },
      contentAssets: true,
    };
  }

  private teamAssignmentInclude() {
    return {
      membership: {
        include: {
          user: true,
          role: { include: { systemRole: true } },
          roles: { include: { role: { include: { systemRole: true } } } },
        },
      },
    };
  }

  private publishingScheduleInclude() {
    return {
      contentAsset: {
        include: {
          workflowInstances: {
            include: {
              currentStep: true,
              currentTask: {
                include: {
                  owner: {
                    include: {
                      user: true,
                      role: { include: { systemRole: true } },
                    },
                  },
                },
              },
            },
            orderBy: { startedAt: "desc" as const },
          },
        },
      },
    };
  }

  private async syncMissedPublishingSlots(
    campaignId: string,
    agencyId: string,
    actorId?: string,
  ) {
    const missed = await this.prisma.publishingSchedule.findMany({
      where: {
        agencyId,
        campaignId,
        scheduledAt: { lt: new Date() },
        status: { in: ["PLANNED", "READY", "SCHEDULED"] },
      },
    });

    for (const slot of missed) {
      const updated = await this.prisma.publishingSchedule.update({
        where: { id: slot.id },
        data: {
          status: "MISSED",
          riskStatus: "OVERDUE",
          version: { increment: 1 },
        },
        include: this.publishingScheduleInclude(),
      });
      await this.publishPublishingEvent(
        DomainEvents.PublishingSlotMissed,
        agencyId,
        actorId ?? null,
        campaignId,
        updated,
      );
    }
  }

  private buildPublishingSummary(slots: any[]) {
    const views = slots.map((slot) => this.toPublishingScheduleView(slot));

    return {
      upcoming: views.filter(
        (slot) => !["PUBLISHED", "MISSED", "CANCELLED"].includes(slot.status),
      ).length,
      ready: views.filter((slot) => slot.readiness === "READY").length,
      atRisk: views.filter((slot) => slot.riskStatus === "AT_RISK").length,
      missed: views.filter((slot) => slot.status === "MISSED").length,
    };
  }

  private toPublishingScheduleView(slot: any) {
    const readiness = this.getPublishingReadiness(slot);
    const riskStatus = this.getPublishingRiskStatus(slot, readiness);
    const workflow = slot.contentAsset?.workflowInstances?.[0];
    const currentTask = workflow?.currentTask;

    return {
      id: slot.id,
      agencyId: slot.agencyId,
      campaignId: slot.campaignId,
      contentAssetId: slot.contentAssetId,
      platform: slot.platform,
      scheduledAt: slot.scheduledAt,
      status: slot.status,
      riskStatus,
      readiness,
      readinessReason: this.getPublishingReadinessReason(slot, readiness),
      timezone: slot.timezone,
      caption: slot.caption,
      note: slot.note,
      cancellationReason: slot.cancellationReason,
      publishedAt: slot.publishedAt,
      publishedUrl: slot.publishedUrl,
      version: slot.version,
      contentAsset: slot.contentAsset
        ? {
            id: slot.contentAsset.id,
            displayCode: slot.contentAsset.displayCode,
            title: slot.contentAsset.title,
            status: slot.contentAsset.status,
          }
        : null,
      workflow: workflow
        ? {
            id: workflow.id,
            status: workflow.status,
            stage: workflow.currentStep?.stage ?? null,
            taskStatus: currentTask?.status ?? null,
            owner: currentTask?.owner
              ? {
                  membershipId: currentTask.owner.id,
                  name:
                    currentTask.owner.user?.name ??
                    currentTask.owner.role?.displayName ??
                    "Owner",
                }
              : null,
          }
        : null,
    };
  }

  private getPublishingReadiness(slot: any) {
    if (slot.status === "PUBLISHED") return "PUBLISHED";
    if (!slot.contentAsset) return "UNLINKED";
    if (slot.contentAsset.status === "COMPLETED") return "READY";

    const workflow = slot.contentAsset.workflowInstances?.[0];
    if (!workflow) return "NOT_STARTED";
    if (workflow.status === "COMPLETED") return "READY";

    const taskStatus = workflow.currentTask?.status;
    if (
      taskStatus === "WAITING_REVIEW" ||
      taskStatus === "WAITING_HANDOFF_ACCEPTANCE"
    )
      return "WAITING_APPROVAL";

    return "IN_PRODUCTION";
  }

  private getPublishingReadinessReason(slot: any, readiness: string) {
    if (readiness === "UNLINKED") return "No content asset linked";
    if (readiness === "NOT_STARTED") return "Content workflow has not started";
    if (readiness === "IN_PRODUCTION")
      return `Content is still in ${slot.contentAsset?.workflowInstances?.[0]?.currentStep?.stage ?? "production"}`;
    if (readiness === "WAITING_APPROVAL")
      return "Content is waiting for approval";
    if (readiness === "READY") return "Content is ready to publish";
    if (readiness === "PUBLISHED") return "Publishing slot is published";
    return null;
  }

  private getPublishingRiskStatus(slot: any, readiness: string) {
    if (slot.status === "MISSED") return "OVERDUE";
    if (slot.status === "PUBLISHED" || slot.status === "CANCELLED")
      return "ON_TRACK";

    const msUntilPublish = new Date(slot.scheduledAt).getTime() - Date.now();
    const isNearPublish = msUntilPublish <= 24 * 60 * 60 * 1000;
    if (isNearPublish && !["READY", "PUBLISHED"].includes(readiness))
      return "AT_RISK";

    return slot.riskStatus ?? "ON_TRACK";
  }

  private async getPublishingSlotView(
    scheduleId: string,
    campaignId: string,
    agencyId: string,
  ) {
    const slot = await this.prisma.publishingSchedule.findFirst({
      where: { id: scheduleId, campaignId, agencyId },
      include: this.publishingScheduleInclude(),
    });
    if (!slot) {
      throw new NotFoundException("Publishing slot not found");
    }
    return slot;
  }

  private async ensurePublishingSlot(
    scheduleId: string,
    campaignId: string,
    agencyId: string,
  ): Promise<PublishingSchedule> {
    const slot = await this.prisma.publishingSchedule.findFirst({
      where: { id: scheduleId, campaignId, agencyId },
    });
    if (!slot) {
      throw new NotFoundException("Publishing slot not found");
    }
    return slot;
  }

  private async ensureCampaignContentAsset(
    contentAssetId: string,
    campaignId: string,
    agencyId: string,
  ) {
    const contentAsset = await this.prisma.contentAsset.findFirst({
      where: {
        id: contentAssetId,
        campaignId,
        agencyId,
        status: { not: "DELETED" },
      },
    });
    if (!contentAsset) {
      throw new BadRequestException(
        "Linked content asset must belong to this campaign",
      );
    }
    return contentAsset;
  }

  private ensureWithinCampaignWindow(
    scheduledAt: Date,
    campaign: { startDate: Date; endDate: Date },
  ) {
    const windowStart = new Date(campaign.startDate);
    const windowEnd = new Date(campaign.endDate);
    windowStart.setHours(0, 0, 0, 0);
    windowEnd.setHours(23, 59, 59, 999);

    if (scheduledAt < windowStart || scheduledAt > windowEnd) {
      throw new BadRequestException(
        "scheduledAt must fall inside the campaign window",
      );
    }
  }

  private async publishPublishingEvent(
    eventName: DomainEventName,
    agencyId: string,
    actorId: string | null,
    campaignId: string,
    slot: PublishingSchedule,
    extraPayload: Record<string, unknown> = {},
  ) {
    await this.eventBus.publish(eventName, {
      agencyId,
      actorId,
      aggregateId: campaignId,
      aggregateType: "Campaign",
      payload: {
        campaignId,
        publishingScheduleId: slot.id,
        contentAssetId: slot.contentAssetId,
        platform: slot.platform,
        scheduledAt: slot.scheduledAt.toISOString(),
        status: slot.status,
        ...extraPayload,
      },
    });
  }

  private normalizeOutboxEvent(event: {
    id: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
    createdAt: Date;
  }) {
    const stored = event.payload as {
      actorId?: string | null;
      occurredAt?: string;
      payload?: Record<string, any>;
    } | null;

    return {
      id: event.id,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      actorId: stored?.actorId ?? null,
      occurredAt: stored?.occurredAt ?? event.createdAt.toISOString(),
      payload: stored?.payload ?? {},
    };
  }

  private formatActivityMessage(
    event: { eventType: string; payload: Record<string, any> },
    membershipNames: Map<string, string>,
  ) {
    const memberName = event.payload.membershipId
      ? (membershipNames.get(event.payload.membershipId) ?? "Team member")
      : "Team member";
    const assignmentRole = this.formatAssignmentRole(
      event.payload.assignmentRole,
    );

    switch (event.eventType) {
      case DomainEvents.CampaignCreated:
        return "Campaign created";
      case DomainEvents.CampaignUpdated:
        return "Campaign details updated";
      case DomainEvents.CampaignActivated:
        return "Campaign activated";
      case DomainEvents.CampaignPaused:
        return "Campaign paused";
      case DomainEvents.CampaignResumed:
        return "Campaign resumed";
      case DomainEvents.CampaignCompleted:
        return "Campaign completed";
      case DomainEvents.CampaignArchived:
        return "Campaign archived";
      case DomainEvents.CampaignRestored:
        return "Campaign restored";
      case DomainEvents.CampaignManagerChanged:
        return `${memberName} assigned as Campaign Manager`;
      case DomainEvents.CampaignTeamMemberAssigned:
        return `${memberName} added as ${assignmentRole}`;
      case DomainEvents.CampaignTeamMemberRemoved:
        return `${memberName} removed from ${assignmentRole}`;
      case DomainEvents.PublishingSlotCreated:
        return `Publishing slot created for ${event.payload.platform ?? "platform"}`;
      case DomainEvents.PublishingSlotUpdated:
        return `Publishing slot updated for ${event.payload.platform ?? "platform"}`;
      case DomainEvents.PublishingSlotRescheduled:
        return `Publishing slot rescheduled for ${event.payload.platform ?? "platform"}`;
      case DomainEvents.PublishingSlotCancelled:
        return `Publishing slot cancelled for ${event.payload.platform ?? "platform"}`;
      case DomainEvents.PublishingSlotPublished:
        return `Publishing slot marked published for ${event.payload.platform ?? "platform"}`;
      case DomainEvents.PublishingSlotMissed:
        return `Publishing slot missed for ${event.payload.platform ?? "platform"}`;
      default:
        return event.eventType;
    }
  }

  private formatAssignmentRole(role?: string) {
    if (!role) return "campaign team";

    const labels: Record<string, string> = {
      CAMPAIGN_MANAGER: "Campaign Manager",
      RELATIONSHIP_MANAGER: "Relationship Manager",
      WRITER: "Writer",
      EDITOR: "Editor",
      DESIGNER: "Designer",
      DOP: "DOP",
      SOCIAL_MEDIA_MANAGER: "Social Media Manager",
      CLIENT_APPROVER: "Client Approver",
      AGENCY_APPROVER: "Agency Approver",
    };

    return labels[role] ?? role.replaceAll("_", " ").toLowerCase();
  }

  private async findCampaignAssignmentMembershipId(
    campaignId: string,
    agencyId: string,
    assignmentRole: CampaignAssignmentRole,
  ) {
    const assignment = await this.prisma.campaignTeamAssignment.findFirst({
      where: { campaignId, agencyId, assignmentRole },
      orderBy: { createdAt: "asc" },
      select: { membershipId: true },
    });

    return assignment?.membershipId ?? null;
  }

  private async generateContentDisplayCode(
    tx: Prisma.TransactionClient,
    agencyId: string,
    type: ContentType,
  ) {
    const sequence = await tx.contentAssetSequence.upsert({
      where: { agencyId_type: { agencyId, type } },
      create: { agencyId, type, nextSequence: 2 },
      update: { nextSequence: { increment: 1 } },
    });
    const numericPart = String(sequence.nextSequence - 1).padStart(3, "0");
    return `${this.contentDisplayPrefix(type)}-${numericPart}`;
  }

  private contentDisplayPrefix(type: ContentType) {
    const prefixes: Record<ContentType, string> = {
      REEL: "REEL",
      CAROUSEL: "CAR",
      STATIC: "STA",
      STORY: "STO",
      BLOG: "BLOG",
      YOUTUBE: "YT",
      AD: "AD",
      OTHER: "CNT",
    };

    return prefixes[type];
  }

  private defaultScriptDueAt(publishingAt: Date) {
    const dueAt = new Date(publishingAt);
    dueAt.setDate(dueAt.getDate() - 4);
    dueAt.setHours(18, 0, 0, 0);
    return dueAt;
  }

  private formatContentType(type: ContentType) {
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }

  private async createTaskNotification(
    tx: Prisma.TransactionClient,
    agencyId: string,
    membershipId: string,
    input: { title: string; body: string; eventType: string },
  ) {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, agencyId, status: "ACTIVE", deletedAt: null },
      select: { userId: true },
    });

    if (!membership) return null;

    return tx.notification.create({
      data: {
        agencyId,
        userId: membership.userId,
        title: input.title,
        body: input.body,
        eventType: input.eventType,
      },
    });
  }

  private async ensureCampaign(id: string, agencyId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (
      !campaign ||
      campaign.agencyId !== agencyId ||
      campaign.status === "DELETED"
    ) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  private async ensureAssignableMembership(
    membershipId: string,
    agencyId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, agencyId, status: "ACTIVE", deletedAt: null },
      include: {
        role: { include: { systemRole: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
      },
    });

    if (!membership) {
      throw new BadRequestException(
        "Membership must be active and belong to the current agency",
      );
    }

    return membership;
  }

  private async ensureSingleAssignmentSlot(
    campaignId: string,
    agencyId: string,
    assignmentRole: CampaignAssignmentRole,
    currentAssignmentId?: string,
  ) {
    if (!SINGLE_ASSIGNMENT_ROLES.has(assignmentRole)) return;

    const existing = await this.prisma.campaignTeamAssignment.findFirst({
      where: {
        agencyId,
        campaignId,
        assignmentRole,
        ...(currentAssignmentId ? { id: { not: currentAssignmentId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        `${assignmentRole} is already assigned for this campaign`,
      );
    }
  }

  private ensureCampaignManager(actor: IdentityContext) {
    const roles = [actor.role, ...(actor.roles ?? [])]
      .filter(Boolean)
      .map((role) => role!.toUpperCase());
    if (!roles.some((role) => role === "OWNER" || role === "MANAGER")) {
      throw new BadRequestException(
        "Only owners and managers can manage campaign operations",
      );
    }
  }

  private async ensureCampaignTeamManager(
    campaignId: string,
    agencyId: string,
    actor: IdentityContext,
  ) {
    const roles = [actor.role, ...(actor.roles ?? [])]
      .filter(Boolean)
      .map((role) => role!.toUpperCase());
    if (roles.some((role) => role === "OWNER" || role === "MANAGER")) return;

    if (!actor.membershipId) {
      throw new BadRequestException("Agency membership context is required");
    }

    const assignment = await this.prisma.campaignTeamAssignment.findFirst({
      where: {
        campaignId,
        agencyId,
        membershipId: actor.membershipId,
        assignmentRole: {
          in: [
            CampaignAssignmentRole.CAMPAIGN_MANAGER,
            CampaignAssignmentRole.RELATIONSHIP_MANAGER,
          ],
        },
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new BadRequestException(
        "Only owners, managers, or campaign managers can manage campaign team assignments",
      );
    }
  }

  private ensurePublishingManager(actor: IdentityContext) {
    const roles = [actor.role, ...(actor.roles ?? [])]
      .filter(Boolean)
      .map((role) => role!.toUpperCase());
    const permissions = new Set(actor.permissions ?? []);
    if (
      roles.some(
        (role) =>
          role === "OWNER" ||
          role === "MANAGER" ||
          role === "SOCIAL_MEDIA_MANAGER",
      ) ||
      permissions.has("PUBLISHING_UPDATE") ||
      permissions.has("PUBLISHING_CREATE")
    ) {
      return;
    }

    throw new BadRequestException(
      "Only owners, managers, or social media managers can manage publishing schedules",
    );
  }

  private async ensureCampaignCanComplete(id: string, agencyId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { deliverablePlans: true, contentAssets: true },
    });

    if (!campaign || campaign.agencyId !== agencyId) {
      throw new NotFoundException("Campaign not found");
    }

    const requiredContentCount = campaign.deliverablePlans.reduce(
      (sum, plan) => sum + plan.quantity,
      0,
    );
    const producedContentCount = campaign.contentAssets.filter(
      (asset) => asset.status !== "DELETED",
    ).length;
    const unfinishedContentCount = campaign.contentAssets.filter(
      (asset) => !["PUBLISHED", "ARCHIVED", "DELETED"].includes(asset.status),
    ).length;

    if (
      requiredContentCount > producedContentCount ||
      unfinishedContentCount > 0
    ) {
      throw new BadRequestException(
        "Campaign still has unfinished deliverables",
      );
    }
  }

  private async generateCampaignCode(agencyId: string) {
    const count = await this.prisma.campaign.count({ where: { agencyId } });
    return `CMP-${String(count + 1).padStart(3, "0")}`;
  }

  private nullIfBlank(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
