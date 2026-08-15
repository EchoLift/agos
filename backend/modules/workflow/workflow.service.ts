import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  BlockerStatus,
  CampaignAssignmentRole,
  ContentAssetStatus,
  ContentRisk,
  ContentStage,
  ContentType,
  Prisma,
  SubmissionStatus,
  SubmissionType,
  TaskStatus,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEventName, DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { isEmailChannelRequired } from "@modules/notification/notification.policy";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ApproveContentDto } from "./dto/approve-content.dto";
import { AssignContentDto } from "./dto/assign-content.dto";
import { BlockContentDto } from "./dto/block-content.dto";
import { CreateContentAssetDto } from "./dto/create-content-asset.dto";
import { RequestChangesDto } from "./dto/request-changes.dto";
import { SubmitWorkDto } from "./dto/submit-work.dto";
import {
  WorkflowActionDto,
  WorkflowActionType,
} from "./dto/workflow-action.dto";
import { WorkflowBoardQueryDto } from "./dto/workflow-board-query.dto";
import { canTransition } from "./workflow-transition-rules";

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async getBoard(
    agencyId: string,
    query: WorkflowBoardQueryDto = {},
    actor?: IdentityContext,
  ) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const canViewBroadWorkflow = actor
      ? this.canViewBroadWorkflow(actor)
      : true;

    if (
      actor &&
      !canViewBroadWorkflow &&
      query.ownerId &&
      query.ownerId !== actor.membershipId
    ) {
      throw new ForbiddenException(
        "You can only filter your own workflow assignments",
      );
    }

    const roleResponsibilities =
      actor && !canViewBroadWorkflow && actor.membershipId
        ? await this.campaignRoleResponsibilities(
            agencyId,
            actor.membershipId,
            query.campaignId,
          )
        : [];

    const assets = await this.prisma.contentAsset.findMany({
      where: {
        agencyId,
        status: { not: ContentAssetStatus.DELETED },
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(!canViewBroadWorkflow && actor?.membershipId
          ? {
              OR: [
                {
                  workflowInstances: {
                    some: {
                      status: WorkflowInstanceStatus.ACTIVE,
                      currentTask: {
                        ownerMembershipId: actor.membershipId,
                      },
                    },
                  },
                },
                ...roleResponsibilities.map((responsibility) => ({
                  campaignId: responsibility.campaignId,
                  workflowInstances: {
                    some: {
                      status: WorkflowInstanceStatus.ACTIVE,
                      currentStep: {
                        stage: { in: responsibility.stages },
                      },
                    },
                  },
                })),
              ],
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: "insensitive" } },
                {
                  displayCode: { contains: query.search, mode: "insensitive" },
                },
                {
                  client: {
                    name: { contains: query.search, mode: "insensitive" },
                  },
                },
                {
                  campaign: {
                    name: { contains: query.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        client: true,
        campaign: true,
        workflowInstances: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            currentStep: true,
            manager: { include: { user: true, role: true } },
            transitions: { orderBy: { createdAt: "desc" }, take: 1 },
            currentTask: {
              include: {
                owner: { include: { user: true, role: true } },
                submissions: { orderBy: { createdAt: "desc" }, take: 1 },
                approvals: { orderBy: { createdAt: "desc" }, take: 1 },
                blockers: { where: { status: BlockerStatus.ACTIVE } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const items = assets
      .map((asset) => {
        const workflow = asset.workflowInstances[0] ?? null;
        const task = workflow?.currentTask ?? null;
        const stage = this.projectContentStage(
          asset.status,
          workflow?.currentStep?.stage ??
            workflow?.transitions[0]?.toStage ??
            null,
        );
        const deadlineAt = task?.deadlineAt ?? workflow?.deadlineAt ?? null;
        const hasActiveBlocker = Boolean(task?.blockers?.length);
        const computedRisk =
          stage === ContentStage.PUBLISHED || stage === ContentStage.ARCHIVED
            ? ContentRisk.ON_TRACK
            : this.computeBoardRisk(
                workflow?.riskStatus ?? ContentRisk.ON_TRACK,
                deadlineAt,
                task?.status,
                now,
              );
        const latestSubmission = task?.submissions?.[0] ?? null;
        const latestApproval = task?.approvals?.[0] ?? null;
        const lastActivityAt = this.maxIsoDate([
          asset.updatedAt,
          workflow?.startedAt,
          task?.updatedAt,
          latestSubmission?.createdAt,
          latestApproval?.createdAt,
          task?.blockers?.[0]?.createdAt,
        ]);
        const isDirectAssignment = task?.owner?.id === actor?.membershipId;
        const isRoleResponsibility = this.isCampaignRoleResponsible(
          roleResponsibilities,
          asset.campaignId,
          stage,
        );

        return {
          contentAssetId: asset.id,
          workflowInstanceId: workflow?.id ?? null,
          workflowTaskId: task?.id ?? null,
          displayCode: asset.displayCode,
          title: asset.title,
          type: asset.type,
          clientId: asset.clientId,
          clientName: asset.client.name,
          clientSummary: this.clientWorkSummary(asset.client),
          campaignId: asset.campaignId,
          campaignName: asset.campaign.name,
          stage,
          owner: task?.owner ? this.memberSummary(task.owner) : null,
          manager: workflow?.manager
            ? this.memberSummary(workflow.manager)
            : null,
          deadlineAt: deadlineAt?.toISOString() ?? null,
          riskStatus: computedRisk,
          taskStatus:
            stage === ContentStage.PUBLISHED
              ? TaskStatus.COMPLETED
              : (task?.status ?? null),
          submissionStatus: latestSubmission?.status ?? null,
          approvalStatus: latestApproval?.status ?? null,
          hasActiveBlocker,
          blockerCount: task?.blockers?.length ?? 0,
          lastActivityAt,
          responsibility: isDirectAssignment
            ? "DIRECT_ASSIGNMENT"
            : isRoleResponsibility
              ? "CAMPAIGN_ROLE"
              : null,
        };
      })
      .filter(
        (item) =>
          !query.ownerId ||
          item.owner?.membershipId === query.ownerId ||
          (!canViewBroadWorkflow &&
            query.ownerId === actor?.membershipId &&
            item.responsibility === "CAMPAIGN_ROLE"),
      )
      .filter((item) => !query.risk || item.riskStatus === query.risk);

    const columns = this.workflowBoardStages().map((stage) => ({
      stage,
      label: this.stageLabel(stage),
      count: items.filter((item) => item.stage === stage).length,
      items: items.filter((item) => item.stage === stage),
    }));

    const summary = {
      active: items.filter(
        (item) => !["PUBLISHED", "ARCHIVED"].includes(item.stage),
      ).length,
      waitingReview: items.filter(
        (item) =>
          item.taskStatus === TaskStatus.WAITING_REVIEW ||
          item.approvalStatus === ApprovalStatus.PENDING,
      ).length,
      blocked: items.filter(
        (item) =>
          item.hasActiveBlocker || item.riskStatus === ContentRisk.BLOCKED,
      ).length,
      overdue: items.filter((item) => item.riskStatus === ContentRisk.OVERDUE)
        .length,
      dueToday: items.filter(
        (item) =>
          item.deadlineAt &&
          new Date(item.deadlineAt) >= todayStart &&
          new Date(item.deadlineAt) < todayEnd,
      ).length,
    };

    return { summary, columns };
  }

  async createContentAsset(dto: CreateContentAssetDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const displayCode = await this.generateDisplayCode(
        tx,
        dto.agencyId,
        dto.type,
      );
      const asset = await tx.contentAsset.create({
        data: {
          agencyId: dto.agencyId,
          clientId: dto.clientId,
          campaignId: dto.campaignId,
          displayCode,
          type: dto.type,
          title: dto.title,
          brief: dto.brief,
          status: ContentAssetStatus.ACTIVE,
        },
      });

      const workflowInstance = await tx.workflowInstance.create({
        data: {
          agencyId: dto.agencyId,
          contentAssetId: asset.id,
          managerMembershipId: dto.managerMembershipId,
          deadlineAt: new Date(dto.deadlineAt),
          riskStatus: ContentRisk.ON_TRACK,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      });

      const initialTask = await tx.workflowTask.create({
        data: {
          agencyId: dto.agencyId,
          workflowInstanceId: workflowInstance.id,
          displayName: `Initial planning for ${displayCode}`,
          ownerMembershipId: dto.currentOwnerMembershipId,
          status: TaskStatus.TODO,
          deadlineAt: new Date(dto.deadlineAt),
        },
      });

      await tx.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: { currentTaskId: initialTask.id },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId: dto.agencyId,
          workflowInstanceId: workflowInstance.id,
          fromStage: null,
          toStage: ContentStage.IDEA,
          changedById: dto.actorId,
          reason: "Content asset created",
        },
      });

      return { asset, workflowInstance, initialTask };
    });

    await this.eventBus.publish(DomainEvents.ContentAssetCreated, {
      agencyId: result.asset.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: result.asset.id,
        workflowInstanceId: result.workflowInstance.id,
        workflowTaskId: result.initialTask.id,
        displayCode: result.asset.displayCode,
      },
    });

    return result.asset;
  }

  async findById(id: string) {
    const contentAsset = await this.prisma.contentAsset.findUnique({
      where: { id },
      include: {
        client: true,
        campaign: true,
        files: true,
        workflowInstances: {
          include: {
            currentTask: true,
            currentStep: true,
            tasks: {
              include: {
                workflowStep: true,
                submissions: true,
                approvals: true,
                blockers: { where: { status: BlockerStatus.ACTIVE } },
              },
            },
            transitions: true,
            assignmentHistory: true,
          },
        },
      },
    });

    if (!contentAsset) {
      throw new NotFoundException("Content asset not found");
    }

    const { client, campaign, ...asset } = contentAsset;
    return {
      ...asset,
      clientSummary: this.clientWorkSummary(client),
      campaignSummary: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        campaignType: campaign.campaignType,
        goal: campaign.goal,
        keyMessage: campaign.keyMessage,
        cta: campaign.cta,
      },
    };
  }

  async updateBrief(id: string, dto: Partial<CreateContentAssetDto>) {
    await this.ensureContentAssetExists(id);
    return this.prisma.contentAsset.update({
      where: { id },
      data: {
        title: dto.title,
        brief: dto.brief,
        version: { increment: 1 },
      },
    });
  }

  async advanceStage(
    id: string,
    dto: { actorId: string; toStage: ContentStage; reason?: string },
  ) {
    const contentAsset = await this.ensureContentAssetExists(id);
    const workflowInstance =
      await this.ensureActiveWorkflowInstanceForContentAsset(id);

    const latestTransition = await this.prisma.workflowTransition.findFirst({
      where: { workflowInstanceId: workflowInstance.id },
      orderBy: { createdAt: "desc" },
    });

    const currentStage = latestTransition?.toStage ?? null;
    if (!canTransition(currentStage, dto.toStage)) {
      throw new BadRequestException("Invalid workflow transition");
    }

    const transition = await this.prisma.workflowTransition.create({
      data: {
        agencyId: workflowInstance.agencyId,
        workflowInstanceId: workflowInstance.id,
        fromStage: currentStage,
        toStage: dto.toStage,
        changedById: dto.actorId,
        reason: dto.reason ?? "Stage advanced",
      },
    });

    await this.prisma.workflowInstance.update({
      where: { id: workflowInstance.id },
      data: { currentStepId: null, version: { increment: 1 } },
    });

    await this.eventBus.publish(DomainEvents.WorkflowStageChanged, {
      agencyId: contentAsset.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: workflowInstance.id,
        transitionId: transition.id,
        fromStage: currentStage,
        toStage: dto.toStage,
      },
    });

    return transition;
  }

  async assign(id: string, dto: AssignContentDto) {
    const contentAsset = await this.ensureContentAssetExists(id);
    const result = await this.prisma.$transaction(async (tx) => {
      const workflowInstance = await this.ensureWorkflowInstance(
        tx,
        contentAsset.agencyId,
        id,
      );
      const previousTask = workflowInstance.currentTaskId
        ? await tx.workflowTask.findUnique({
            where: { id: workflowInstance.currentTaskId },
          })
        : null;

      const task = await tx.workflowTask.create({
        data: {
          agencyId: contentAsset.agencyId,
          workflowInstanceId: workflowInstance.id,
          workflowStepId: dto.workflowStepId,
          displayName: `${dto.stage} for ${contentAsset.displayCode}`,
          ownerMembershipId: dto.assigneeId,
          status: TaskStatus.TODO,
          deadlineAt: new Date(dto.deadlineAt),
        },
      });

      await tx.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          currentStepId: dto.workflowStepId,
          currentTaskId: task.id,
          deadlineAt: new Date(dto.deadlineAt),
          riskStatus: ContentRisk.ON_TRACK,
          version: { increment: 1 },
        },
      });

      await tx.assignmentHistory.create({
        data: {
          agencyId: contentAsset.agencyId,
          workflowInstanceId: workflowInstance.id,
          workflowTaskId: task.id,
          fromMembershipId: previousTask?.ownerMembershipId,
          toMembershipId: dto.assigneeId,
          workflowStepId: dto.workflowStepId,
          changedByMembershipId: dto.actorId,
          reason: dto.reason,
        },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId: contentAsset.agencyId,
          workflowInstanceId: workflowInstance.id,
          fromStepId: workflowInstance.currentStepId,
          toStepId: dto.workflowStepId,
          toStage: dto.stage,
          changedById: dto.actorId,
          reason: dto.reason ?? "Assigned content",
        },
      });

      await this.createTaskNotification(
        tx,
        contentAsset.agencyId,
        dto.assigneeId,
        {
          title: `Task assigned: ${contentAsset.displayCode}`,
          body: `${dto.stage} is due ${new Date(dto.deadlineAt).toISOString()}`,
          eventType: DomainEvents.ContentAssigned,
        },
      );

      return { workflowInstance, task };
    });

    await this.eventBus.publish(DomainEvents.ContentAssigned, {
      agencyId: contentAsset.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: result.workflowInstance.id,
        workflowTaskId: result.task.id,
        assigneeId: dto.assigneeId,
        stage: dto.stage,
        deadlineAt: dto.deadlineAt,
      },
    });

    return result.task;
  }

  async submit(id: string, dto: SubmitWorkDto) {
    await this.ensureContentAssetExists(id);
    const task = await this.ensureTaskBelongsToContentAsset(
      dto.workflowTaskId,
      id,
    );

    if (task.ownerMembershipId !== dto.actorId) {
      throw new BadRequestException(
        "Only the current task owner can submit this work",
      );
    }

    this.ensureSubmissionHasContent(dto);

    const latestSubmission = await this.prisma.submission.findFirst({
      where: {
        workflowTaskId: dto.workflowTaskId,
        submissionType: dto.submissionType,
      },
      orderBy: { version: "desc" },
    });

    const submission = await this.prisma.submission.create({
      data: {
        agencyId: task.agencyId,
        workflowTaskId: dto.workflowTaskId,
        submittedBy: dto.actorId,
        submissionType: dto.submissionType,
        version: (latestSubmission?.version ?? 0) + 1,
        body: dto.body,
        externalLink: dto.externalLink,
        status: SubmissionStatus.SUBMITTED,
      },
    });

    await this.prisma.workflowTask.update({
      where: { id: task.id },
      data: { status: TaskStatus.WAITING_REVIEW, version: { increment: 1 } },
    });

    await this.createMembershipNotification(
      task.agencyId,
      task.workflowInstance.managerMembershipId,
      {
        title: "Submission received",
        body: `A workflow submission is waiting for review.`,
        eventType: DomainEvents.SubmissionCreated,
      },
    );

    await this.eventBus.publish(DomainEvents.SubmissionCreated, {
      agencyId: task.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: task.workflowInstanceId,
        workflowTaskId: task.id,
        submissionId: submission.id,
        version: submission.version,
      },
    });

    return submission;
  }

  async markSubmissionSeen(
    id: string,
    submissionId: string,
    dto: { actorId: string },
  ) {
    await this.ensureContentAssetExists(id);
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { workflowTask: { include: { workflowInstance: true } } },
    });

    if (
      !submission ||
      submission.workflowTask.workflowInstance.contentAssetId !== id
    ) {
      throw new NotFoundException("Submission not found");
    }

    if (submission.status !== SubmissionStatus.SUBMITTED) {
      return submission;
    }

    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.SEEN, seenAt: new Date() },
    });

    await this.eventBus.publish(DomainEvents.SubmissionViewed, {
      agencyId: submission.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: submission.workflowTask.workflowInstanceId,
        workflowTaskId: submission.workflowTaskId,
        submissionId: submission.id,
      },
    });

    return updated;
  }

  async recallSubmission(
    id: string,
    dto: { actorId: string; submissionId: string },
  ) {
    await this.ensureContentAssetExists(id);
    const submission = await this.prisma.submission.findUnique({
      where: { id: dto.submissionId },
      include: { workflowTask: { include: { workflowInstance: true } } },
    });

    if (
      !submission ||
      submission.workflowTask.workflowInstance.contentAssetId !== id
    ) {
      throw new NotFoundException("Submission not found");
    }

    if (
      submission.submittedBy !== dto.actorId ||
      submission.status !== SubmissionStatus.SUBMITTED ||
      submission.seenAt
    ) {
      throw new BadRequestException("Submission can no longer be recalled");
    }

    const updated = await this.prisma.submission.update({
      where: { id: dto.submissionId },
      data: { status: SubmissionStatus.RECALLED, recalledAt: new Date() },
    });

    await this.prisma.workflowTask.update({
      where: { id: submission.workflowTaskId },
      data: { status: TaskStatus.IN_PROGRESS, version: { increment: 1 } },
    });

    await this.eventBus.publish(DomainEvents.SubmissionRecalled, {
      agencyId: submission.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: submission.workflowTask.workflowInstanceId,
        workflowTaskId: submission.workflowTaskId,
        submissionId: submission.id,
      },
    });

    return updated;
  }

  async performAction(
    id: string,
    dto: WorkflowActionDto,
    actor: IdentityContext,
  ) {
    if (!actor.agencyId || !actor.membershipId) {
      throw new ForbiddenException("Agency membership context is required");
    }

    const task = await this.currentTaskForAction(id, actor.agencyId);
    const stage =
      task.workflowStep?.stage ??
      (await this.latestWorkflowStage(task.workflowInstanceId));

    if (!stage) {
      throw new BadRequestException("This workflow has no active stage");
    }

    if (dto.action === WorkflowActionType.BLOCK) {
      return this.block(id, {
        actorId: actor.membershipId,
        workflowTaskId: task.id,
        reason: dto.reason || dto.comment || "Blocked",
        details: dto.body,
      });
    }

    if (dto.action === WorkflowActionType.UNBLOCK) {
      return this.unblock(id, actor.membershipId);
    }

    if (dto.action === WorkflowActionType.SUBMIT_FOR_REVIEW) {
      return this.submitForReviewAction(
        id,
        task,
        stage,
        dto,
        actor.membershipId,
      );
    }

    if (
      dto.action === WorkflowActionType.APPROVE ||
      dto.action === WorkflowActionType.ACCEPT_HANDOVER
    ) {
      return this.approveAction(id, task, stage, dto, actor.membershipId);
    }

    if (
      dto.action === WorkflowActionType.REQUEST_CHANGES ||
      dto.action === WorkflowActionType.REJECT
    ) {
      return this.returnAction(id, task, stage, dto, actor.membershipId);
    }

    throw new BadRequestException("Unsupported workflow action");
  }

  async approve(id: string, dto: ApproveContentDto) {
    await this.ensureContentAssetExists(id);
    const task = await this.ensureTaskBelongsToContentAsset(
      dto.workflowTaskId,
      id,
    );
    const existing = await this.prisma.approval.findUnique({
      where: {
        agencyId_idempotencyKey: {
          agencyId: task.agencyId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const approval = await this.prisma.approval.create({
      data: {
        agencyId: task.agencyId,
        workflowTaskId: task.id,
        approverId: dto.actorId,
        status: ApprovalStatus.APPROVED,
        comment: dto.comment,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    const autoAdvance =
      dto.nextOwnerId && dto.nextStage && dto.nextDeadlineAt
        ? null
        : await this.resolveAutomaticAdvance(task, id);
    const nextOwnerId = dto.nextOwnerId ?? autoAdvance?.nextOwnerId;
    const nextStage = dto.nextStage ?? autoAdvance?.nextStage;
    const nextDeadlineAt = dto.nextDeadlineAt ?? autoAdvance?.nextDeadlineAt;

    if (
      nextStage &&
      !canTransition(task.workflowStep?.stage ?? null, nextStage)
    ) {
      const latestStage = await this.latestWorkflowStage(
        task.workflowInstanceId,
      );
      if (!canTransition(latestStage, nextStage)) {
        throw new BadRequestException("Invalid workflow transition");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (autoAdvance?.completeWorkflow) {
        await tx.workflowInstance.update({
          where: { id: task.workflowInstanceId },
          data: {
            status: WorkflowInstanceStatus.COMPLETED,
            completedAt: new Date(),
            riskStatus: ContentRisk.ON_TRACK,
            version: { increment: 1 },
          },
        });

        await tx.contentAsset.update({
          where: { id },
          data: {
            status: ContentAssetStatus.COMPLETED,
            version: { increment: 1 },
          },
        });

        await tx.publishingSchedule.updateMany({
          where: {
            agencyId: task.agencyId,
            contentAssetId: id,
            status: { in: ["PLANNED", "SCHEDULED"] },
          },
          data: {
            status: "READY",
            riskStatus: ContentRisk.ON_TRACK,
            version: { increment: 1 },
          },
        });

        await tx.workflowTransition.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            fromStepId: task.workflowStepId,
            toStage: ContentStage.SCHEDULED,
            changedById: dto.actorId,
            reason: "Approved and ready to publish",
          },
        });

        await this.publishWithinTransaction(
          tx,
          DomainEvents.WorkflowStageChanged,
          {
            agencyId: task.agencyId,
            actorId: dto.actorId,
            aggregateId: task.workflowInstanceId,
            aggregateType: "WorkflowInstance",
            payload: {
              contentAssetId: id,
              workflowInstanceId: task.workflowInstanceId,
              workflowTaskId: task.id,
              toStage: ContentStage.SCHEDULED,
            },
          },
        );
      } else if (nextOwnerId && nextStage && nextDeadlineAt) {
        const nextTask = await tx.workflowTask.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            workflowStepId: dto.nextWorkflowStepId,
            displayName: `${nextStage} after approval`,
            ownerMembershipId: nextOwnerId,
            status: TaskStatus.TODO,
            deadlineAt: new Date(nextDeadlineAt),
          },
        });

        await tx.workflowInstance.update({
          where: { id: task.workflowInstanceId },
          data: {
            currentStepId: dto.nextWorkflowStepId,
            currentTaskId: nextTask.id,
            deadlineAt: new Date(nextDeadlineAt),
            riskStatus: ContentRisk.ON_TRACK,
            version: { increment: 1 },
          },
        });

        await tx.assignmentHistory.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            workflowTaskId: nextTask.id,
            fromMembershipId: task.ownerMembershipId,
            toMembershipId: nextOwnerId,
            workflowStepId: dto.nextWorkflowStepId,
            changedByMembershipId: dto.actorId,
            reason: "Approval moved content to next task",
          },
        });

        await tx.workflowTransition.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            fromStepId: task.workflowStepId,
            toStepId: dto.nextWorkflowStepId,
            toStage: nextStage,
            changedById: dto.actorId,
            reason: "Approved",
          },
        });

        await this.createTaskNotification(tx, task.agencyId, nextOwnerId, {
          title: `New task: ${this.stageLabel(nextStage)}`,
          body: `A content item moved to ${this.stageLabel(nextStage)} and is due ${new Date(nextDeadlineAt).toISOString()}`,
          eventType: DomainEvents.ContentAssigned,
        });

        await this.publishWithinTransaction(tx, DomainEvents.ContentAssigned, {
          agencyId: task.agencyId,
          actorId: dto.actorId,
          aggregateId: task.workflowInstanceId,
          aggregateType: "WorkflowTask",
          payload: {
            contentAssetId: id,
            workflowInstanceId: task.workflowInstanceId,
            assigneeId: nextOwnerId,
            stage: nextStage,
            deadlineAt: nextDeadlineAt,
          },
        });

        await this.publishWithinTransaction(
          tx,
          DomainEvents.WorkflowStageChanged,
          {
            agencyId: task.agencyId,
            actorId: dto.actorId,
            aggregateId: task.workflowInstanceId,
            aggregateType: "WorkflowInstance",
            payload: {
              contentAssetId: id,
              workflowInstanceId: task.workflowInstanceId,
              workflowTaskId: task.id,
              toStage: nextStage,
            },
          },
        );
      }
    });

    await this.eventBus.publish(DomainEvents.ApprovalGranted, {
      agencyId: task.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: task.workflowInstanceId,
        workflowTaskId: task.id,
        approvalId: approval.id,
      },
    });

    return approval;
  }

  async requestChanges(id: string, dto: RequestChangesDto) {
    await this.ensureContentAssetExists(id);
    const task = await this.ensureTaskBelongsToContentAsset(
      dto.workflowTaskId,
      id,
    );

    if (
      dto.returnToStage &&
      !canTransition(task.workflowStep?.stage ?? null, dto.returnToStage)
    ) {
      throw new BadRequestException("Invalid workflow transition");
    }

    const approval = await this.prisma.approval.create({
      data: {
        agencyId: task.agencyId,
        workflowTaskId: task.id,
        approverId: dto.actorId,
        status: ApprovalStatus.CHANGES_REQUESTED,
        comment: dto.comment,
        idempotencyKey: `${task.id}:changes:${Date.now()}`,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const returnTask = await tx.workflowTask.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          workflowStepId: dto.returnWorkflowStepId,
          displayName: `${dto.returnToStage} changes requested`,
          ownerMembershipId: dto.returnToOwnerId,
          status: TaskStatus.TODO,
          deadlineAt: task.deadlineAt,
        },
      });

      await tx.workflowInstance.update({
        where: { id: task.workflowInstanceId },
        data: {
          currentStepId: dto.returnWorkflowStepId,
          currentTaskId: returnTask.id,
          riskStatus: ContentRisk.NEEDS_ATTENTION,
          version: { increment: 1 },
        },
      });

      await tx.assignmentHistory.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: returnTask.id,
          fromMembershipId: task.ownerMembershipId,
          toMembershipId: dto.returnToOwnerId,
          workflowStepId: dto.returnWorkflowStepId,
          changedByMembershipId: dto.actorId,
          reason: "Changes requested",
        },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          fromStepId: task.workflowStepId,
          toStepId: dto.returnWorkflowStepId,
          toStage: dto.returnToStage,
          changedById: dto.actorId,
          reason: dto.comment,
        },
      });

      await this.createTaskNotification(
        tx,
        task.agencyId,
        dto.returnToOwnerId,
        {
          title: "Changes requested",
          body: dto.comment || "Changes were requested on your submitted work.",
          eventType: DomainEvents.ChangesRequested,
        },
      );
    });

    await this.eventBus.publish(DomainEvents.ChangesRequested, {
      agencyId: task.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: task.workflowInstanceId,
        workflowTaskId: task.id,
        approvalId: approval.id,
      },
    });

    return approval;
  }

  async block(id: string, dto: BlockContentDto) {
    await this.ensureContentAssetExists(id);
    const task = await this.ensureTaskBelongsToContentAsset(
      dto.workflowTaskId,
      id,
    );
    const blocker = await this.prisma.blocker.create({
      data: {
        agencyId: task.agencyId,
        workflowTaskId: task.id,
        blockedBy: dto.actorId,
        reason: dto.reason,
        details: dto.details,
        status: BlockerStatus.ACTIVE,
      },
    });

    await this.prisma.$transaction([
      this.prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: TaskStatus.BLOCKED, version: { increment: 1 } },
      }),
      this.prisma.workflowInstance.update({
        where: { id: task.workflowInstanceId },
        data: { riskStatus: ContentRisk.BLOCKED, version: { increment: 1 } },
      }),
    ]);

    await this.eventBus.publish(DomainEvents.BlockerRaised, {
      agencyId: task.agencyId,
      actorId: dto.actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: task.workflowInstanceId,
        workflowTaskId: task.id,
        blockerId: blocker.id,
        reason: dto.reason,
      },
    });

    return blocker;
  }

  async unblock(id: string, actorId: string) {
    const workflowInstance =
      await this.ensureActiveWorkflowInstanceForContentAsset(id);
    const taskId = workflowInstance.currentTaskId;

    if (!taskId) {
      throw new BadRequestException("No current task found for this workflow");
    }

    await this.prisma.blocker.updateMany({
      where: { workflowTaskId: taskId, status: BlockerStatus.ACTIVE },
      data: { status: BlockerStatus.RESOLVED, resolvedAt: new Date() },
    });

    const updatedTask = await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { status: TaskStatus.IN_PROGRESS, version: { increment: 1 } },
    });

    await this.prisma.workflowInstance.update({
      where: { id: workflowInstance.id },
      data: { riskStatus: ContentRisk.ON_TRACK, version: { increment: 1 } },
    });

    await this.eventBus.publish(DomainEvents.BlockerResolved, {
      agencyId: workflowInstance.agencyId,
      actorId,
      payload: {
        contentAssetId: id,
        workflowInstanceId: workflowInstance.id,
        workflowTaskId: taskId,
      },
    });

    return updatedTask;
  }

  private async submitForReviewAction(
    contentAssetId: string,
    task: Prisma.WorkflowTaskGetPayload<{
      include: {
        workflowInstance: {
          include: {
            contentAsset: {
              include: {
                campaign: {
                  include: { teamAssignments: true; publishingSchedules: true };
                };
                client: true;
              };
            };
          };
        };
        workflowStep: true;
        owner: true;
      };
    }>,
    stage: ContentStage,
    dto: WorkflowActionDto,
    actorMembershipId: string,
  ) {
    if (!this.canSubmitCurrentStage(actorMembershipId, task, stage)) {
      throw new ForbiddenException(
        "Only the current task owner can submit this work",
      );
    }

    this.ensureSubmissionHasContent(dto);

    const reviewStage = this.reviewStageFor(stage);
    if (!reviewStage) {
      throw new BadRequestException(
        `${this.stageLabel(stage)} cannot be submitted for review`,
      );
    }

    const submissionType = this.submissionTypeFor(stage);
    const reviewOwnerId = this.reviewOwnerForStage(
      stage,
      task.workflowInstance,
    );
    const reviewStepId = await this.workflowStepIdForStage(
      task.agencyId,
      task.workflowInstanceId,
      reviewStage,
    );
    const latestSubmission = await this.prisma.submission.findFirst({
      where: { workflowTaskId: task.id, submissionType },
      orderBy: { version: "desc" },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      if (task.ownerMembershipId !== actorMembershipId) {
        await tx.workflowTask.update({
          where: { id: task.id },
          data: {
            ownerMembershipId: actorMembershipId,
            version: { increment: 1 },
          },
        });

        await tx.assignmentHistory.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            workflowTaskId: task.id,
            fromMembershipId: task.ownerMembershipId,
            toMembershipId: actorMembershipId,
            workflowStepId: task.workflowStepId,
            changedByMembershipId: actorMembershipId,
            reason: "Claimed through campaign role assignment",
          },
        });
      }

      const submission = await tx.submission.create({
        data: {
          agencyId: task.agencyId,
          workflowTaskId: task.id,
          submittedBy: actorMembershipId,
          submissionType,
          version: (latestSubmission?.version ?? 0) + 1,
          body: dto.body,
          externalLink: dto.externalLink,
          status: SubmissionStatus.SUBMITTED,
        },
      });

      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const reviewTask = await tx.workflowTask.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          workflowStepId: reviewStepId,
          displayName: `${this.stageLabel(reviewStage)} for ${task.workflowInstance.contentAsset.displayCode}`,
          ownerMembershipId: reviewOwnerId,
          status: TaskStatus.WAITING_REVIEW,
          deadlineAt: task.deadlineAt,
        },
      });

      await tx.workflowInstance.update({
        where: { id: task.workflowInstanceId },
        data: {
          currentStepId: reviewStepId,
          currentTaskId: reviewTask.id,
          riskStatus: ContentRisk.ON_TRACK,
          version: { increment: 1 },
        },
      });

      await tx.assignmentHistory.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: reviewTask.id,
          fromMembershipId: actorMembershipId,
          toMembershipId: reviewOwnerId,
          workflowStepId: reviewStepId,
          changedByMembershipId: actorMembershipId,
          reason: "Submitted for review",
        },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          fromStepId: task.workflowStepId,
          toStepId: reviewStepId,
          fromStage: stage,
          toStage: reviewStage,
          changedById: actorMembershipId,
          reason: dto.comment || "Submitted for review",
        },
      });

      await this.createTaskNotification(tx, task.agencyId, reviewOwnerId, {
        title: `Review needed: ${task.workflowInstance.contentAsset.displayCode}`,
        body:
          dto.comment || `${this.stageLabel(stage)} was submitted for review.`,
        eventType: DomainEvents.SubmissionCreated,
      });

      await this.publishWithinTransaction(tx, DomainEvents.SubmissionCreated, {
        agencyId: task.agencyId,
        actorId: actorMembershipId,
        aggregateId: task.workflowInstanceId,
        aggregateType: "WorkflowTask",
        payload: {
          contentAssetId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: task.id,
          submissionId: submission.id,
          submissionType,
          reviewTaskId: reviewTask.id,
          reviewStage,
        },
      });

      await this.publishWithinTransaction(tx, DomainEvents.ContentAssigned, {
        agencyId: task.agencyId,
        actorId: actorMembershipId,
        aggregateId: task.workflowInstanceId,
        aggregateType: "WorkflowTask",
        payload: {
          contentAssetId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: reviewTask.id,
          assigneeId: reviewOwnerId,
          stage: reviewStage,
          deadlineAt: task.deadlineAt.toISOString(),
        },
      });

      await this.publishWithinTransaction(
        tx,
        DomainEvents.WorkflowStageChanged,
        {
          agencyId: task.agencyId,
          actorId: actorMembershipId,
          aggregateId: task.workflowInstanceId,
          aggregateType: "WorkflowInstance",
          payload: {
            contentAssetId,
            workflowInstanceId: task.workflowInstanceId,
            workflowTaskId: reviewTask.id,
            fromStage: stage,
            toStage: reviewStage,
          },
        },
      );

      return { submission, reviewTask };
    });

    return result;
  }

  private canSubmitCurrentStage(
    actorMembershipId: string,
    task: Prisma.WorkflowTaskGetPayload<{
      include: {
        workflowInstance: {
          include: {
            contentAsset: {
              include: {
                campaign: {
                  include: { teamAssignments: true; publishingSchedules: true };
                };
                client: true;
              };
            };
          };
        };
        workflowStep: true;
        owner: true;
      };
    }>,
    stage: ContentStage,
  ) {
    if (task.ownerMembershipId === actorMembershipId) {
      return true;
    }

    return task.workflowInstance.contentAsset.campaign.teamAssignments.some(
      (assignment) =>
        assignment.membershipId === actorMembershipId &&
        this.stagesForCampaignRole(assignment.assignmentRole).includes(stage),
    );
  }

  private async approveAction(
    contentAssetId: string,
    task: Prisma.WorkflowTaskGetPayload<{
      include: {
        workflowInstance: {
          include: {
            contentAsset: {
              include: {
                campaign: {
                  include: { teamAssignments: true; publishingSchedules: true };
                };
                client: true;
              };
            };
          };
        };
        workflowStep: true;
        owner: true;
      };
    }>,
    stage: ContentStage,
    dto: WorkflowActionDto,
    actorMembershipId: string,
  ) {
    if (
      task.ownerMembershipId !== actorMembershipId &&
      !this.canReviewWorkflow(actorMembershipId, task.workflowInstance)
    ) {
      throw new ForbiddenException("You cannot approve this workflow task");
    }

    const existing = await this.prisma.approval.findUnique({
      where: {
        agencyId_idempotencyKey: {
          agencyId: task.agencyId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    const next = await this.nextStageAfterApproval(task, stage, contentAssetId);

    const result = await this.prisma.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: {
          agencyId: task.agencyId,
          workflowTaskId: task.id,
          approverId: actorMembershipId,
          status: ApprovalStatus.APPROVED,
          comment: dto.comment,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (next.completeWorkflow) {
        await tx.workflowInstance.update({
          where: { id: task.workflowInstanceId },
          data: {
            status: WorkflowInstanceStatus.COMPLETED,
            completedAt: new Date(),
            riskStatus: ContentRisk.ON_TRACK,
            version: { increment: 1 },
          },
        });
        await tx.contentAsset.update({
          where: { id: contentAssetId },
          data: {
            status: ContentAssetStatus.COMPLETED,
            version: { increment: 1 },
          },
        });
        await tx.publishingSchedule.updateMany({
          where: {
            agencyId: task.agencyId,
            contentAssetId,
            status: { in: ["PLANNED", "SCHEDULED"] },
          },
          data: {
            status: "READY",
            riskStatus: ContentRisk.ON_TRACK,
            version: { increment: 1 },
          },
        });
      } else if (next.stage && next.ownerId && next.deadlineAt) {
        const nextStepId = await this.workflowStepIdForStage(
          task.agencyId,
          task.workflowInstanceId,
          next.stage,
        );
        const nextTask = await tx.workflowTask.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            workflowStepId: nextStepId,
            displayName: `${this.stageLabel(next.stage)} for ${task.workflowInstance.contentAsset.displayCode}`,
            ownerMembershipId: next.ownerId,
            status: TaskStatus.TODO,
            deadlineAt: next.deadlineAt,
          },
        });

        await tx.workflowInstance.update({
          where: { id: task.workflowInstanceId },
          data: {
            currentStepId: nextStepId,
            currentTaskId: nextTask.id,
            deadlineAt: next.deadlineAt,
            riskStatus: ContentRisk.ON_TRACK,
            version: { increment: 1 },
          },
        });

        await tx.assignmentHistory.create({
          data: {
            agencyId: task.agencyId,
            workflowInstanceId: task.workflowInstanceId,
            workflowTaskId: nextTask.id,
            fromMembershipId: task.ownerMembershipId,
            toMembershipId: next.ownerId,
            workflowStepId: nextStepId,
            changedByMembershipId: actorMembershipId,
            reason:
              dto.action === WorkflowActionType.ACCEPT_HANDOVER
                ? "Handover accepted"
                : "Approved",
          },
        });

        await this.createTaskNotification(tx, task.agencyId, next.ownerId, {
          title: `New task: ${this.stageLabel(next.stage)}`,
          body:
            dto.comment || `Content moved to ${this.stageLabel(next.stage)}.`,
          eventType: DomainEvents.ContentAssigned,
        });

        await this.publishWithinTransaction(tx, DomainEvents.ContentAssigned, {
          agencyId: task.agencyId,
          actorId: actorMembershipId,
          aggregateId: task.workflowInstanceId,
          aggregateType: "WorkflowTask",
          payload: {
            contentAssetId,
            workflowInstanceId: task.workflowInstanceId,
            assigneeId: next.ownerId,
            stage: next.stage,
            deadlineAt: next.deadlineAt.toISOString(),
          },
        });
      }

      await tx.workflowTransition.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          fromStepId: task.workflowStepId,
          toStage: next.stage ?? ContentStage.SCHEDULED,
          changedById: actorMembershipId,
          reason:
            dto.action === WorkflowActionType.ACCEPT_HANDOVER
              ? "Handover accepted"
              : "Approved",
        },
      });

      await this.publishWithinTransaction(
        tx,
        DomainEvents.WorkflowStageChanged,
        {
          agencyId: task.agencyId,
          actorId: actorMembershipId,
          aggregateId: task.workflowInstanceId,
          aggregateType: "WorkflowInstance",
          payload: {
            contentAssetId,
            workflowInstanceId: task.workflowInstanceId,
            workflowTaskId: task.id,
            fromStage: stage,
            toStage: next.stage ?? ContentStage.SCHEDULED,
          },
        },
      );

      await this.publishWithinTransaction(tx, DomainEvents.ApprovalGranted, {
        agencyId: task.agencyId,
        actorId: actorMembershipId,
        aggregateId: task.id,
        aggregateType: "WorkflowTask",
        payload: {
          contentAssetId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: task.id,
          approvalId: approval.id,
        },
      });

      if (dto.action === WorkflowActionType.ACCEPT_HANDOVER) {
        await this.publishWithinTransaction(
          tx,
          DomainEvents.SubmissionAccepted,
          {
            agencyId: task.agencyId,
            actorId: actorMembershipId,
            aggregateId: task.id,
            aggregateType: "WorkflowTask",
            payload: {
              contentAssetId,
              workflowInstanceId: task.workflowInstanceId,
              workflowTaskId: task.id,
            },
          },
        );
      }

      return approval;
    });

    return result;
  }

  private async returnAction(
    contentAssetId: string,
    task: Prisma.WorkflowTaskGetPayload<{
      include: {
        workflowInstance: {
          include: {
            contentAsset: {
              include: {
                campaign: {
                  include: { teamAssignments: true; publishingSchedules: true };
                };
                client: true;
              };
            };
          };
        };
        workflowStep: true;
        owner: true;
      };
    }>,
    stage: ContentStage,
    dto: WorkflowActionDto,
    actorMembershipId: string,
  ) {
    if (
      task.ownerMembershipId !== actorMembershipId &&
      !this.canReviewWorkflow(actorMembershipId, task.workflowInstance)
    ) {
      throw new ForbiddenException("You cannot return this workflow task");
    }

    const existing = await this.prisma.approval.findUnique({
      where: {
        agencyId_idempotencyKey: {
          agencyId: task.agencyId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    const previous = await this.previousStageForReturn(task, stage);
    if (!previous.stage || !previous.ownerId) {
      throw new BadRequestException(
        `${this.stageLabel(stage)} cannot be returned`,
      );
    }
    const previousStepId = await this.workflowStepIdForStage(
      task.agencyId,
      task.workflowInstanceId,
      previous.stage,
    );
    const approvalStatus =
      dto.action === WorkflowActionType.REJECT
        ? ApprovalStatus.REJECTED
        : ApprovalStatus.CHANGES_REQUESTED;
    const eventType =
      dto.action === WorkflowActionType.REJECT
        ? DomainEvents.ApprovalRejected
        : DomainEvents.ChangesRequested;

    const approval = await this.prisma.$transaction(async (tx) => {
      const createdApproval = await tx.approval.create({
        data: {
          agencyId: task.agencyId,
          workflowTaskId: task.id,
          approverId: actorMembershipId,
          status: approvalStatus,
          comment: dto.comment || dto.reason,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const returnTask = await tx.workflowTask.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          workflowStepId: previousStepId,
          displayName: `${this.stageLabel(previous.stage)} changes for ${task.workflowInstance.contentAsset.displayCode}`,
          ownerMembershipId: previous.ownerId,
          status: TaskStatus.TODO,
          deadlineAt: previous.deadlineAt ?? task.deadlineAt,
        },
      });

      await tx.workflowInstance.update({
        where: { id: task.workflowInstanceId },
        data: {
          currentStepId: previousStepId,
          currentTaskId: returnTask.id,
          deadlineAt: previous.deadlineAt ?? task.deadlineAt,
          riskStatus: ContentRisk.NEEDS_ATTENTION,
          version: { increment: 1 },
        },
      });

      await tx.assignmentHistory.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: returnTask.id,
          fromMembershipId: task.ownerMembershipId,
          toMembershipId: previous.ownerId,
          workflowStepId: previousStepId,
          changedByMembershipId: actorMembershipId,
          reason: dto.comment || dto.reason || "Changes requested",
        },
      });

      await tx.workflowTransition.create({
        data: {
          agencyId: task.agencyId,
          workflowInstanceId: task.workflowInstanceId,
          fromStepId: task.workflowStepId,
          toStepId: previousStepId,
          fromStage: stage,
          toStage: previous.stage,
          changedById: actorMembershipId,
          reason: dto.comment || dto.reason || "Changes requested",
        },
      });

      await this.createTaskNotification(tx, task.agencyId, previous.ownerId, {
        title:
          dto.action === WorkflowActionType.REJECT
            ? "Work rejected"
            : "Changes requested",
        body:
          dto.comment || dto.reason || "Please review the requested changes.",
        eventType,
      });

      await this.publishWithinTransaction(tx, eventType, {
        agencyId: task.agencyId,
        actorId: actorMembershipId,
        aggregateId: task.id,
        aggregateType: "WorkflowTask",
        payload: {
          contentAssetId,
          workflowInstanceId: task.workflowInstanceId,
          workflowTaskId: task.id,
          returnTaskId: returnTask.id,
          approvalId: createdApproval.id,
          fromStage: stage,
          toStage: previous.stage,
          assigneeId: previous.ownerId,
        },
      });

      if (stage === ContentStage.EDITOR_INTAKE) {
        await this.publishWithinTransaction(
          tx,
          DomainEvents.SubmissionRejected,
          {
            agencyId: task.agencyId,
            actorId: actorMembershipId,
            aggregateId: task.id,
            aggregateType: "WorkflowTask",
            payload: {
              contentAssetId,
              workflowInstanceId: task.workflowInstanceId,
              workflowTaskId: task.id,
            },
          },
        );
      }

      await this.publishWithinTransaction(
        tx,
        DomainEvents.WorkflowStageChanged,
        {
          agencyId: task.agencyId,
          actorId: actorMembershipId,
          aggregateId: task.workflowInstanceId,
          aggregateType: "WorkflowInstance",
          payload: {
            contentAssetId,
            workflowInstanceId: task.workflowInstanceId,
            workflowTaskId: returnTask.id,
            fromStage: stage,
            toStage: previous.stage,
          },
        },
      );

      return createdApproval;
    });

    return approval;
  }

  private async currentTaskForAction(contentAssetId: string, agencyId: string) {
    const workflowInstance = await this.prisma.workflowInstance.findFirst({
      where: {
        agencyId,
        contentAssetId,
        status: WorkflowInstanceStatus.ACTIVE,
      },
      include: {
        currentTask: {
          include: {
            workflowStep: true,
            owner: true,
            workflowInstance: {
              include: {
                contentAsset: {
                  include: {
                    client: true,
                    campaign: {
                      include: {
                        teamAssignments: true,
                        publishingSchedules: {
                          where: { contentAssetId },
                          orderBy: { scheduledAt: "asc" },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!workflowInstance?.currentTask) {
      throw new NotFoundException("Active workflow task not found");
    }

    return workflowInstance.currentTask;
  }

  private reviewStageFor(stage: ContentStage) {
    const reviewStages: Partial<Record<ContentStage, ContentStage>> = {
      [ContentStage.WRITING]: ContentStage.MANAGER_SCRIPT_REVIEW,
      [ContentStage.SHOOT]: ContentStage.EDITOR_INTAKE,
      [ContentStage.EDITING]: ContentStage.MANAGER_EDIT_REVIEW,
    };

    return reviewStages[stage] ?? null;
  }

  private submissionTypeFor(stage: ContentStage) {
    const submissionTypes: Partial<Record<ContentStage, SubmissionType>> = {
      [ContentStage.WRITING]: SubmissionType.SCRIPT,
      [ContentStage.SHOOT]: SubmissionType.RAW_FOOTAGE,
      [ContentStage.EDITING]: SubmissionType.FINAL_CUT,
      [ContentStage.SCHEDULED]: SubmissionType.PUBLISHED_LINK,
    };

    const submissionType = submissionTypes[stage];
    if (!submissionType) {
      throw new BadRequestException(
        `${this.stageLabel(stage)} does not support submissions`,
      );
    }
    return submissionType;
  }

  private ensureSubmissionHasContent(dto: {
    body?: string;
    externalLink?: string;
  }) {
    if (!dto.body?.trim() && !dto.externalLink?.trim()) {
      throw new BadRequestException(
        "Add a link or note before submitting this work",
      );
    }
  }

  private reviewOwnerForStage(
    stage: ContentStage,
    workflowInstance: {
      managerMembershipId: string;
      contentAsset: {
        campaign: {
          teamAssignments: Array<{
            membershipId: string;
            assignmentRole: CampaignAssignmentRole;
          }>;
        };
      };
    },
  ) {
    if (stage === ContentStage.SHOOT) {
      return this.requiredCampaignAssignee(
        workflowInstance.contentAsset.campaign.teamAssignments,
        CampaignAssignmentRole.EDITOR,
        "Assign an editor before DOP footage can be handed over",
      );
    }

    return workflowInstance.managerMembershipId;
  }

  private async nextStageAfterApproval(
    task: {
      agencyId: string;
      workflowInstanceId: string;
      deadlineAt: Date;
      workflowInstance: {
        contentAsset: {
          campaign: {
            teamAssignments: Array<{
              membershipId: string;
              assignmentRole: CampaignAssignmentRole;
            }>;
            publishingSchedules: Array<{ scheduledAt: Date }>;
          };
        };
      };
    },
    stage: ContentStage,
    contentAssetId: string,
  ) {
    const publishingAt =
      task.workflowInstance.contentAsset.campaign.publishingSchedules[0]
        ?.scheduledAt ?? task.deadlineAt;
    const teamAssignments =
      task.workflowInstance.contentAsset.campaign.teamAssignments;

    if (stage === ContentStage.MANAGER_SCRIPT_REVIEW) {
      return {
        stage: ContentStage.SHOOT,
        ownerId: this.requiredCampaignAssignee(
          teamAssignments,
          CampaignAssignmentRole.DOP,
          "Assign a DOP before approving script work",
        ),
        deadlineAt: this.relativeDeadline(publishingAt, -2, 18),
      };
    }

    if (stage === ContentStage.EDITOR_INTAKE) {
      return {
        stage: ContentStage.EDITING,
        ownerId: this.requiredCampaignAssignee(
          teamAssignments,
          CampaignAssignmentRole.EDITOR,
          "Assign an editor before accepting footage",
        ),
        deadlineAt: this.relativeDeadline(publishingAt, -1, 18),
      };
    }

    if (
      stage === ContentStage.MANAGER_EDIT_REVIEW ||
      stage === ContentStage.CLIENT_APPROVAL
    ) {
      return { completeWorkflow: true };
    }

    if (stage === ContentStage.SHOOT) {
      return {
        stage: ContentStage.EDITOR_INTAKE,
        ownerId: this.requiredCampaignAssignee(
          teamAssignments,
          CampaignAssignmentRole.EDITOR,
          "Assign an editor before approving shoot work",
        ),
        deadlineAt: this.relativeDeadline(publishingAt, -1, 12),
      };
    }

    const autoAdvance = await this.resolveAutomaticAdvance(
      task,
      contentAssetId,
    );
    if (autoAdvance?.completeWorkflow) return { completeWorkflow: true };
    if (
      autoAdvance?.nextStage &&
      autoAdvance.nextOwnerId &&
      autoAdvance.nextDeadlineAt
    ) {
      return {
        stage: autoAdvance.nextStage,
        ownerId: autoAdvance.nextOwnerId,
        deadlineAt: new Date(autoAdvance.nextDeadlineAt),
      };
    }

    throw new BadRequestException(
      `${this.stageLabel(stage)} cannot be approved`,
    );
  }

  private async previousStageForReturn(
    task: {
      agencyId: string;
      workflowInstanceId: string;
      deadlineAt: Date;
      workflowInstance: {
        contentAsset: {
          campaign: {
            teamAssignments: Array<{
              membershipId: string;
              assignmentRole: CampaignAssignmentRole;
            }>;
            publishingSchedules: Array<{ scheduledAt: Date }>;
          };
        };
      };
    },
    stage: ContentStage,
  ) {
    const publishingAt =
      task.workflowInstance.contentAsset.campaign.publishingSchedules[0]
        ?.scheduledAt ?? task.deadlineAt;
    const teamAssignments =
      task.workflowInstance.contentAsset.campaign.teamAssignments;

    if (stage === ContentStage.MANAGER_SCRIPT_REVIEW) {
      return {
        stage: ContentStage.WRITING,
        ownerId:
          (await this.latestSubmitterFor(
            task.workflowInstanceId,
            SubmissionType.SCRIPT,
          )) ??
          this.requiredCampaignAssignee(
            teamAssignments,
            CampaignAssignmentRole.WRITER,
            "Assign a writer before requesting script changes",
          ),
        deadlineAt: this.relativeDeadline(publishingAt, -4, 18),
      };
    }

    if (stage === ContentStage.EDITOR_INTAKE) {
      return {
        stage: ContentStage.SHOOT,
        ownerId:
          (await this.latestSubmitterFor(
            task.workflowInstanceId,
            SubmissionType.RAW_FOOTAGE,
          )) ??
          this.requiredCampaignAssignee(
            teamAssignments,
            CampaignAssignmentRole.DOP,
            "Assign a DOP before rejecting footage handover",
          ),
        deadlineAt: this.relativeDeadline(publishingAt, -2, 18),
      };
    }

    if (stage === ContentStage.MANAGER_EDIT_REVIEW) {
      return {
        stage: ContentStage.EDITING,
        ownerId:
          (await this.latestSubmitterFor(
            task.workflowInstanceId,
            SubmissionType.FINAL_CUT,
          )) ??
          this.requiredCampaignAssignee(
            teamAssignments,
            CampaignAssignmentRole.EDITOR,
            "Assign an editor before requesting edit changes",
          ),
        deadlineAt: this.relativeDeadline(publishingAt, -1, 18),
      };
    }

    return {};
  }

  private async latestSubmitterFor(
    workflowInstanceId: string,
    submissionType: SubmissionType,
  ) {
    const latest = await this.prisma.submission.findFirst({
      where: {
        submissionType,
        workflowTask: { workflowInstanceId },
      },
      orderBy: { createdAt: "desc" },
    });

    return latest?.submittedBy ?? null;
  }

  private async workflowStepIdForStage(
    agencyId: string,
    workflowInstanceId: string,
    stage: ContentStage,
  ) {
    const workflowInstance = await this.prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      select: { templateId: true },
    });

    if (!workflowInstance?.templateId) return null;

    const step = await this.prisma.workflowStep.findFirst({
      where: { agencyId, templateId: workflowInstance.templateId, stage },
      select: { id: true },
    });

    return step?.id ?? null;
  }

  private canReviewWorkflow(
    actorMembershipId: string,
    workflowInstance: {
      managerMembershipId: string;
      contentAsset: {
        campaign: {
          teamAssignments: Array<{
            membershipId: string;
            assignmentRole: CampaignAssignmentRole;
          }>;
        };
      };
    },
  ) {
    if (workflowInstance.managerMembershipId === actorMembershipId) return true;
    const reviewerRoles: CampaignAssignmentRole[] = [
      CampaignAssignmentRole.CAMPAIGN_MANAGER,
      CampaignAssignmentRole.RELATIONSHIP_MANAGER,
      CampaignAssignmentRole.AGENCY_APPROVER,
      CampaignAssignmentRole.CLIENT_APPROVER,
      CampaignAssignmentRole.EDITOR,
    ];

    return workflowInstance.contentAsset.campaign.teamAssignments.some(
      (assignment) =>
        assignment.membershipId === actorMembershipId &&
        reviewerRoles.includes(assignment.assignmentRole),
    );
  }

  private async ensureContentAssetExists(id: string) {
    const contentAsset = await this.prisma.contentAsset.findUnique({
      where: { id },
    });

    if (!contentAsset) {
      throw new NotFoundException("Content asset not found");
    }

    return contentAsset;
  }

  private async resolveAutomaticAdvance(
    task: {
      agencyId: string;
      workflowInstanceId: string;
      workflowStep?: { stage: ContentStage } | null;
    },
    contentAssetId: string,
  ) {
    const currentStage =
      task.workflowStep?.stage ??
      (await this.latestWorkflowStage(task.workflowInstanceId));
    if (!currentStage) return null;

    const context = await this.prisma.contentAsset.findUnique({
      where: { id: contentAssetId },
      include: {
        campaign: {
          include: {
            teamAssignments: true,
            publishingSchedules: {
              where: { contentAssetId },
              orderBy: { scheduledAt: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!context) return null;
    const publishingAt =
      context.campaign.publishingSchedules[0]?.scheduledAt ?? new Date();

    if (currentStage === ContentStage.WRITING) {
      return {
        nextStage: ContentStage.SHOOT,
        nextOwnerId: this.requiredCampaignAssignee(
          context.campaign.teamAssignments,
          CampaignAssignmentRole.DOP,
          "Assign a DOP before approving script work",
        ),
        nextDeadlineAt: this.relativeDeadline(
          publishingAt,
          -2,
          18,
        ).toISOString(),
      };
    }

    if (currentStage === ContentStage.SHOOT) {
      return {
        nextStage: ContentStage.EDITOR_INTAKE,
        nextOwnerId: this.requiredCampaignAssignee(
          context.campaign.teamAssignments,
          CampaignAssignmentRole.EDITOR,
          "Assign an editor before approving shoot work",
        ),
        nextDeadlineAt: this.relativeDeadline(
          publishingAt,
          -1,
          12,
        ).toISOString(),
      };
    }

    if (currentStage === ContentStage.EDITOR_INTAKE) {
      return {
        nextStage: ContentStage.EDITING,
        nextOwnerId: this.requiredCampaignAssignee(
          context.campaign.teamAssignments,
          CampaignAssignmentRole.EDITOR,
          "Assign an editor before accepting footage",
        ),
        nextDeadlineAt: this.relativeDeadline(
          publishingAt,
          -1,
          18,
        ).toISOString(),
      };
    }

    if (
      currentStage === ContentStage.EDITING ||
      currentStage === ContentStage.MANAGER_EDIT_REVIEW
    ) {
      return { completeWorkflow: true };
    }

    return null;
  }

  private async latestWorkflowStage(workflowInstanceId: string) {
    const latestTransition = await this.prisma.workflowTransition.findFirst({
      where: { workflowInstanceId },
      orderBy: { createdAt: "desc" },
    });
    return latestTransition?.toStage ?? null;
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
    responsibilities: Array<{ campaignId: string; stages: ContentStage[] }>,
    campaignId: string,
    stage?: ContentStage | null,
  ) {
    if (!stage) return false;
    return responsibilities.some(
      (responsibility) =>
        responsibility.campaignId === campaignId &&
        responsibility.stages.includes(stage),
    );
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

  private requiredCampaignAssignee(
    assignments: Array<{
      membershipId: string;
      assignmentRole: CampaignAssignmentRole;
    }>,
    assignmentRole: CampaignAssignmentRole,
    message: string,
  ) {
    const assignment = assignments.find(
      (item) => item.assignmentRole === assignmentRole,
    );
    if (!assignment) {
      throw new BadRequestException(message);
    }
    return assignment.membershipId;
  }

  private relativeDeadline(
    publishingAt: Date,
    daysOffset: number,
    hour: number,
  ) {
    const deadline = new Date(publishingAt);
    deadline.setDate(deadline.getDate() + daysOffset);
    deadline.setHours(hour, 0, 0, 0);
    return deadline;
  }

  private async createTaskNotification(
    tx: Prisma.TransactionClient,
    agencyId: string,
    membershipId: string,
    input: { title: string; body: string; eventType: string },
  ) {
    if (!("membership" in tx) || !("notification" in tx)) return null;
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, agencyId, status: "ACTIVE", deletedAt: null },
      select: { userId: true },
    });

    if (!membership) return null;

    const notification = await tx.notification.create({
      data: {
        agencyId,
        userId: membership.userId,
        title: input.title,
        body: input.body,
        eventType: input.eventType,
      },
    });

    await this.queueEmailDeliveryForNotification(
      tx,
      agencyId,
      notification.id,
      input.eventType,
    );

    return notification;
  }

  private async publishWithinTransaction(
    tx: Prisma.TransactionClient,
    eventType: DomainEventName,
    input: {
      agencyId: string;
      actorId?: string | null;
      aggregateId: string;
      aggregateType: string;
      payload: Record<string, unknown>;
    },
  ) {
    if (typeof this.eventBus.publishWithinTransaction !== "function")
      return null;
    return this.eventBus.publishWithinTransaction(tx, eventType, input);
  }

  private async createMembershipNotification(
    agencyId: string,
    membershipId: string,
    input: { title: string; body: string; eventType: string },
  ) {
    if (!this.prisma.membership || !this.prisma.notification) return null;
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, agencyId, status: "ACTIVE", deletedAt: null },
      select: { userId: true },
    });

    if (!membership) return null;

    const notification = await this.prisma.notification.create({
      data: {
        agencyId,
        userId: membership.userId,
        title: input.title,
        body: input.body,
        eventType: input.eventType,
      },
    });

    await this.queueEmailDeliveryForNotification(
      this.prisma,
      agencyId,
      notification.id,
      input.eventType,
    );

    return notification;
  }

  private async queueEmailDeliveryForNotification(
    tx: Prisma.TransactionClient | PrismaService,
    agencyId: string,
    notificationId: string,
    eventType: string,
  ) {
    if (!isEmailChannelRequired(eventType) || !("notificationDelivery" in tx)) {
      return null;
    }

    const delivery = await tx.notificationDelivery.create({
      data: {
        agencyId,
        notificationId,
        channel: "EMAIL",
        status: "QUEUED",
      },
    });

    const event = {
      agencyId,
      actorId: null,
      aggregateId: delivery.id,
      aggregateType: "NotificationDelivery",
      payload: { deliveryId: delivery.id },
    };

    if (typeof this.eventBus.publishWithinTransaction === "function") {
      await this.eventBus.publishWithinTransaction(
        tx as Prisma.TransactionClient,
        DomainEvents.NotificationQueued,
        event,
      );
    } else {
      await this.eventBus.publish(DomainEvents.NotificationQueued, event);
    }

    return delivery;
  }

  private async ensureActiveWorkflowInstanceForContentAsset(
    contentAssetId: string,
  ) {
    const workflowInstance = await this.prisma.workflowInstance.findFirst({
      where: { contentAssetId, status: WorkflowInstanceStatus.ACTIVE },
    });

    if (!workflowInstance) {
      throw new NotFoundException("Active workflow instance not found");
    }

    return workflowInstance;
  }

  private async ensureTaskBelongsToContentAsset(
    workflowTaskId: string,
    contentAssetId: string,
  ) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: workflowTaskId },
      include: { workflowInstance: true, workflowStep: true },
    });

    if (!task || task.workflowInstance.contentAssetId !== contentAssetId) {
      throw new NotFoundException(
        "Workflow task not found for this content asset",
      );
    }

    return task;
  }

  private async ensureWorkflowInstance(
    tx: Prisma.TransactionClient,
    agencyId: string,
    contentAssetId: string,
  ) {
    const existing = await tx.workflowInstance.findFirst({
      where: {
        agencyId,
        contentAssetId,
        status: WorkflowInstanceStatus.ACTIVE,
      },
    });

    if (existing) {
      return existing;
    }

    throw new NotFoundException("Active workflow instance not found");
  }

  private async generateDisplayCode(
    tx: Prisma.TransactionClient,
    agencyId: string,
    type: ContentType,
  ): Promise<string> {
    const sequence = await tx.contentAssetSequence.upsert({
      where: { agencyId_type: { agencyId, type } },
      create: { agencyId, type, nextSequence: 2 },
      update: { nextSequence: { increment: 1 } },
    });
    const numericPart = String(sequence.nextSequence - 1).padStart(3, "0");
    return `${this.displayPrefix(type)}-${numericPart}`;
  }

  private displayPrefix(type: ContentType): string {
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

  private workflowBoardStages() {
    return [
      ContentStage.IDEA,
      ContentStage.WRITING,
      ContentStage.MANAGER_SCRIPT_REVIEW,
      ContentStage.SHOOT,
      ContentStage.EDITOR_INTAKE,
      ContentStage.EDITING,
      ContentStage.MANAGER_EDIT_REVIEW,
      ContentStage.CLIENT_APPROVAL,
      ContentStage.SCHEDULED,
      ContentStage.PUBLISHED,
    ];
  }

  private stageLabel(stage: ContentStage) {
    return stage
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
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

  private computeBoardRisk(
    currentRisk: ContentRisk,
    deadlineAt: Date | null | undefined,
    taskStatus: TaskStatus | null | undefined,
    now: Date,
  ) {
    if (
      currentRisk === ContentRisk.BLOCKED ||
      taskStatus === TaskStatus.BLOCKED
    ) {
      return ContentRisk.BLOCKED;
    }

    if (deadlineAt && deadlineAt < now && taskStatus !== TaskStatus.COMPLETED) {
      return ContentRisk.OVERDUE;
    }

    return currentRisk;
  }

  private maxIsoDate(values: Array<Date | null | undefined>) {
    const dates = values.filter((value): value is Date => Boolean(value));
    if (!dates.length) return new Date().toISOString();
    return new Date(
      Math.max(...dates.map((date) => date.getTime())),
    ).toISOString();
  }

  private memberSummary(member: {
    id: string;
    user?: { name: string | null } | null;
    role?: { displayName: string } | null;
  }) {
    return {
      membershipId: member.id,
      name: member.user?.name || "Unassigned",
      role: member.role?.displayName || null,
    };
  }

  private canViewBroadWorkflow(actor: IdentityContext) {
    const roles = [actor.role, ...(actor.roles ?? [])]
      .filter(Boolean)
      .map((role) => role!.toUpperCase());
    return roles.some((role) => role === "OWNER" || role === "MANAGER");
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
}
