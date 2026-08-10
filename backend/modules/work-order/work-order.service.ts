import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  WorkOrderStatus,
  WorkOrderSubmissionStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";
import {
  ReviewWorkOrderDto,
  SubmitWorkOrderDto,
} from "./dto/work-order-action.dto";

@Injectable()
export class WorkOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateWorkOrderDto, actor: IdentityContext) {
    const agencyId = this.requireAgency(actor);
    const creatorId = this.requireMembership(actor);
    this.ensureCanManage(actor);
    const dueAt = this.parseDate(dto.dueAt, "dueAt");

    const [assignee, reviewer, client] = await Promise.all([
      this.findActiveMembership(agencyId, dto.assigneeMembershipId),
      dto.reviewerMembershipId
        ? this.findActiveMembership(agencyId, dto.reviewerMembershipId)
        : Promise.resolve(null),
      dto.clientId
        ? this.prisma.client.findFirst({
            where: { id: dto.clientId, agencyId, deletedAt: null },
          })
        : Promise.resolve(null),
    ]);

    if (!assignee) throw new BadRequestException("Assignee is not active");
    if (dto.reviewerMembershipId && !reviewer)
      throw new BadRequestException("Reviewer is not active");
    if (dto.clientId && !client)
      throw new BadRequestException("Client does not belong to this agency");

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          agencyId,
          clientId: dto.clientId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          workType: dto.workType,
          priority: dto.priority,
          assigneeMembershipId: dto.assigneeMembershipId,
          reviewerMembershipId: dto.reviewerMembershipId,
          createdByMembershipId: creatorId,
          dueAt,
          estimatedHours: dto.estimatedHours,
          rewardAmount:
            dto.rewardAmount == null
              ? undefined
              : new Prisma.Decimal(dto.rewardAmount),
          rewardCurrency: dto.rewardAmount == null ? undefined : dto.rewardCurrency,
        },
        include: this.includeGraph(),
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.WorkOrderCreated,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: workOrder.id,
          aggregateType: "WorkOrder",
          payload: {
            workOrderId: workOrder.id,
            assigneeMembershipId: workOrder.assigneeMembershipId,
            reviewerMembershipId: workOrder.reviewerMembershipId,
            dueAt: workOrder.dueAt.toISOString(),
          },
        },
      );

      return this.serialize(workOrder);
    });
  }

  async findMany(actor: IdentityContext) {
    const agencyId = this.requireAgency(actor);
    const membershipId = this.requireMembership(actor);
    const where: Prisma.WorkOrderWhereInput = {
      agencyId,
      deletedAt: null,
      ...(this.canManage(actor)
        ? {}
        : {
            OR: [
              { assigneeMembershipId: membershipId },
              { reviewerMembershipId: membershipId },
            ],
          }),
    };

    const workOrders = await this.prisma.workOrder.findMany({
      where,
      include: this.includeGraph(),
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });

    return workOrders.map((workOrder) => this.serialize(workOrder));
  }

  async findById(id: string, actor: IdentityContext) {
    const workOrder = await this.findVisibleWorkOrder(id, actor);
    return this.serialize(workOrder);
  }

  async update(id: string, dto: UpdateWorkOrderDto, actor: IdentityContext) {
    const agencyId = this.requireAgency(actor);
    this.ensureCanManage(actor);
    await this.findVisibleWorkOrder(id, actor);

    if (dto.assigneeMembershipId) {
      const assignee = await this.findActiveMembership(
        agencyId,
        dto.assigneeMembershipId,
      );
      if (!assignee) throw new BadRequestException("Assignee is not active");
    }
    if (dto.reviewerMembershipId) {
      const reviewer = await this.findActiveMembership(
        agencyId,
        dto.reviewerMembershipId,
      );
      if (!reviewer) throw new BadRequestException("Reviewer is not active");
    }
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, agencyId, deletedAt: null },
      });
      if (!client)
        throw new BadRequestException("Client does not belong to this agency");
    }

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.update({
        where: { id },
        data: {
          ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.workType !== undefined ? { workType: dto.workType } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.assigneeMembershipId !== undefined
            ? { assigneeMembershipId: dto.assigneeMembershipId }
            : {}),
          ...(dto.reviewerMembershipId !== undefined
            ? { reviewerMembershipId: dto.reviewerMembershipId }
            : {}),
          ...(dto.dueAt !== undefined
            ? { dueAt: this.parseDate(dto.dueAt, "dueAt") }
            : {}),
          ...(dto.estimatedHours !== undefined
            ? { estimatedHours: dto.estimatedHours }
            : {}),
          ...(dto.rewardAmount !== undefined
            ? {
                rewardAmount:
                  dto.rewardAmount == null
                    ? null
                    : new Prisma.Decimal(dto.rewardAmount),
              }
            : {}),
          ...(dto.rewardCurrency !== undefined
            ? { rewardCurrency: dto.rewardCurrency }
            : {}),
          version: { increment: 1 },
        },
        include: this.includeGraph(),
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.WorkOrderUpdated,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: workOrder.id,
          aggregateType: "WorkOrder",
          payload: { workOrderId: workOrder.id },
        },
      );

      return this.serialize(workOrder);
    });
  }

  async submit(id: string, dto: SubmitWorkOrderDto, actor: IdentityContext) {
    const agencyId = this.requireAgency(actor);
    const membershipId = this.requireMembership(actor);
    const workOrder = await this.findVisibleWorkOrder(id, actor);
    if (workOrder.assigneeMembershipId !== membershipId) {
      throw new ForbiddenException("Only the assignee can submit this gig");
    }
    const acceptingSubmissionStatuses = new Set<WorkOrderStatus>([
      WorkOrderStatus.ASSIGNED,
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.CHANGES_REQUESTED,
    ]);
    if (!acceptingSubmissionStatuses.has(workOrder.status)) {
      throw new BadRequestException("This gig is not accepting submissions");
    }
    if (!dto.body?.trim() && !dto.externalLink?.trim()) {
      throw new BadRequestException("Add notes or a link before submitting");
    }

    return this.prisma.$transaction(async (tx) => {
      const lastSubmission = await tx.workOrderSubmission.findFirst({
        where: { workOrderId: id },
        orderBy: { version: "desc" },
      });
      const submission = await tx.workOrderSubmission.create({
        data: {
          agencyId,
          workOrderId: id,
          submittedById: membershipId,
          version: (lastSubmission?.version ?? 0) + 1,
          body: dto.body?.trim(),
          externalLink: dto.externalLink?.trim(),
        },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.SUBMITTED,
          version: { increment: 1 },
        },
        include: this.includeGraph(),
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.WorkOrderSubmitted,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: id,
          aggregateType: "WorkOrder",
          payload: {
            workOrderId: id,
            submissionId: submission.id,
            version: submission.version,
          },
        },
      );

      return this.serialize(updated);
    });
  }

  async approve(id: string, dto: ReviewWorkOrderDto, actor: IdentityContext) {
    return this.review(id, dto, actor, "approve");
  }

  async requestChanges(
    id: string,
    dto: ReviewWorkOrderDto,
    actor: IdentityContext,
  ) {
    return this.review(id, dto, actor, "requestChanges");
  }

  private async review(
    id: string,
    dto: ReviewWorkOrderDto,
    actor: IdentityContext,
    action: "approve" | "requestChanges",
  ) {
    const agencyId = this.requireAgency(actor);
    const membershipId = this.requireMembership(actor);
    const workOrder = await this.findVisibleWorkOrder(id, actor);
    const isReviewer = workOrder.reviewerMembershipId === membershipId;
    if (!isReviewer && !this.canManage(actor)) {
      throw new ForbiddenException("Only the reviewer can review this gig");
    }
    if (workOrder.status !== WorkOrderStatus.SUBMITTED) {
      throw new BadRequestException("This gig is not waiting for review");
    }
    if (action === "requestChanges" && !dto.comment?.trim()) {
      throw new BadRequestException("Add a reason before requesting changes");
    }

    return this.prisma.$transaction(async (tx) => {
      const latestSubmission = await tx.workOrderSubmission.findFirst({
        where: { workOrderId: id },
        orderBy: { version: "desc" },
      });
      if (!latestSubmission) {
        throw new BadRequestException("No submission found for review");
      }

      await tx.workOrderSubmission.update({
        where: { id: latestSubmission.id },
        data: {
          status:
            action === "approve"
              ? WorkOrderSubmissionStatus.ACCEPTED
              : WorkOrderSubmissionStatus.CHANGES_REQUESTED,
          reviewComment: dto.comment?.trim(),
          reviewedAt: new Date(),
        },
      });

      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status:
            action === "approve"
              ? WorkOrderStatus.COMPLETED
              : WorkOrderStatus.CHANGES_REQUESTED,
          completedAt: action === "approve" ? new Date() : null,
          version: { increment: 1 },
        },
        include: this.includeGraph(),
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        action === "approve"
          ? DomainEvents.WorkOrderApproved
          : DomainEvents.WorkOrderChangesRequested,
        {
          agencyId,
          actorId: actor.userId,
          aggregateId: id,
          aggregateType: "WorkOrder",
          payload: {
            workOrderId: id,
            submissionId: latestSubmission.id,
            comment: dto.comment?.trim(),
          },
        },
      );

      return this.serialize(updated);
    });
  }

  private async findVisibleWorkOrder(id: string, actor: IdentityContext) {
    const agencyId = this.requireAgency(actor);
    const membershipId = this.requireMembership(actor);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, agencyId, deletedAt: null },
      include: this.includeGraph(),
    });
    if (!workOrder) throw new NotFoundException("Gig not found");
    if (
      !this.canManage(actor) &&
      workOrder.assigneeMembershipId !== membershipId &&
      workOrder.reviewerMembershipId !== membershipId
    ) {
      throw new ForbiddenException("You cannot access this gig");
    }
    return workOrder;
  }

  private findActiveMembership(agencyId: string, membershipId: string) {
    return this.prisma.membership.findFirst({
      where: { id: membershipId, agencyId, status: "ACTIVE" },
    });
  }

  private includeGraph() {
    return {
      client: true,
      assignee: { include: { user: true } },
      reviewer: { include: { user: true } },
      createdBy: { include: { user: true } },
      submissions: {
        include: { submittedBy: { include: { user: true } } },
        orderBy: { version: "desc" as const },
      },
    };
  }

  private serialize(workOrder: any) {
    return {
      id: workOrder.id,
      agencyId: workOrder.agencyId,
      clientId: workOrder.clientId,
      client: workOrder.client
        ? {
            id: workOrder.client.id,
            name: workOrder.client.displayName ?? workOrder.client.name,
            industry: workOrder.client.industry,
          }
        : null,
      title: workOrder.title,
      description: workOrder.description,
      workType: workOrder.workType,
      priority: workOrder.priority,
      status: workOrder.status,
      dueAt: workOrder.dueAt,
      estimatedHours: workOrder.estimatedHours,
      rewardAmount: workOrder.rewardAmount?.toString?.() ?? null,
      rewardCurrency: workOrder.rewardCurrency,
      completedAt: workOrder.completedAt,
      cancelledAt: workOrder.cancelledAt,
      version: workOrder.version,
      assignee: this.serializeMembership(workOrder.assignee),
      reviewer: this.serializeMembership(workOrder.reviewer),
      createdBy: this.serializeMembership(workOrder.createdBy),
      submissions: (workOrder.submissions ?? []).map((submission: any) => ({
        id: submission.id,
        version: submission.version,
        body: submission.body,
        externalLink: submission.externalLink,
        status: submission.status,
        reviewComment: submission.reviewComment,
        reviewedAt: submission.reviewedAt,
        createdAt: submission.createdAt,
        submittedBy: this.serializeMembership(submission.submittedBy),
      })),
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
    };
  }

  private serializeMembership(membership?: any | null) {
    if (!membership) return null;
    return {
      id: membership.id,
      name: membership.user?.name ?? "Unknown",
    };
  }

  private ensureCanManage(actor: IdentityContext) {
    if (!this.canManage(actor)) {
      throw new ForbiddenException("Only owners and managers can manage gigs");
    }
  }

  private canManage(actor: IdentityContext) {
    return this.roleKeys(actor).some((role) =>
      ["OWNER", "ADMIN", "MANAGER"].includes(role),
    );
  }

  private requireAgency(actor: IdentityContext) {
    if (!actor.agencyId) {
      throw new BadRequestException("Agency context is required");
    }
    return actor.agencyId;
  }

  private requireMembership(actor: IdentityContext) {
    if (!actor.membershipId) {
      throw new BadRequestException("Membership context is required");
    }
    return actor.membershipId;
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return parsed;
  }

  private roleKeys(actor: IdentityContext) {
    return [...(actor.roles ?? []), actor.role ?? ""]
      .filter(Boolean)
      .map((role) => role.toUpperCase().replace(/[\s-]+/g, "_"));
  }
}
