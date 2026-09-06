import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { UpdateEntitlementDto } from "./dto/update-entitlement.dto";
import {
  CreatePricingPlanDto,
  UpdatePricingPlanDto,
} from "./dto/pricing-plan.dto";
import {
  CreatePricingDiscountDto,
  UpdatePricingDiscountDto,
} from "./dto/pricing-discount.dto";

const ACTIVITY_EVENTS = [
  "CampaignCreated",
  "ContentAssetCreated",
  "SubmissionCreated",
  "ApprovalGranted",
  "MemberInvited",
  "GoogleCalendarConnected",
  "ClientAnalyticsAssetUploaded",
  "WorkOrderSubmitted",
];

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listPricingPlans() {
    return this.prisma.pricingPlan.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { paymentOrders: true } },
        discounts: {
          include: { discount: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async createPricingPlan(dto: CreatePricingPlanDto, actorUserId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.pricingPlan.create({
          data: {
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
            durationMonths: dto.durationMonths,
            priceAmountMinor: dto.priceAmountMinor,
            currency: "INR",
            teamLimit: dto.teamLimit ?? null,
            displayOrder: dto.displayOrder,
            isActive: dto.isActive,
          },
        });
        await this.catalogAudit(
          tx,
          actorUserId,
          "PRICING_PLAN_CREATED",
          "PricingPlan",
          plan.id,
          null,
          plan,
        );
        return plan;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new BadRequestException("Pricing plan code already exists.");
      throw error;
    }
  }

  async updatePricingPlan(
    id: string,
    dto: UpdatePricingPlanDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.pricingPlan.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException("Pricing plan not found.");
      const plan = await tx.pricingPlan.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.durationMonths !== undefined
            ? { durationMonths: dto.durationMonths }
            : {}),
          ...(dto.priceAmountMinor !== undefined
            ? { priceAmountMinor: dto.priceAmountMinor }
            : {}),
          ...(dto.teamLimit !== undefined ? { teamLimit: dto.teamLimit } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      const eventType =
        dto.isActive === false && previous.isActive
          ? "PRICING_PLAN_DISABLED"
          : dto.isActive === true && !previous.isActive
            ? "PRICING_PLAN_ENABLED"
            : "PRICING_PLAN_UPDATED";
      await this.catalogAudit(
        tx,
        actorUserId,
        eventType,
        "PricingPlan",
        id,
        previous,
        plan,
      );
      return plan;
    });
  }

  listPricingDiscounts() {
    return this.prisma.pricingDiscount.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        plans: { include: { plan: true } },
        _count: { select: { redemptions: true } },
      },
    });
  }

  async createPricingDiscount(
    dto: CreatePricingDiscountDto,
    actorUserId: string,
  ) {
    this.validateDiscount(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.ensurePlans(tx, dto.planIds);
      const discount = await tx.pricingDiscount.create({
        data: {
          name: dto.name.trim(),
          type: dto.type,
          value: dto.value,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          isActive: dto.isActive,
          maxRedemptions: dto.maxRedemptions ?? null,
          maxRedemptionsPerAgency: dto.maxRedemptionsPerAgency ?? null,
          plans: { create: dto.planIds.map((planId) => ({ planId })) },
        },
        include: { plans: { include: { plan: true } } },
      });
      await this.catalogAudit(
        tx,
        actorUserId,
        "DISCOUNT_CREATED",
        "PricingDiscount",
        discount.id,
        null,
        discount,
      );
      return discount;
    });
  }

  async updatePricingDiscount(
    id: string,
    dto: UpdatePricingDiscountDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.pricingDiscount.findUnique({
        where: { id },
        include: { plans: true },
      });
      if (!previous) throw new NotFoundException("Pricing discount not found.");
      this.validateDiscount({
        ...dto,
        type: dto.type ?? previous.type,
        value: dto.value ?? previous.value,
        startsAt:
          dto.startsAt === undefined
            ? (previous.startsAt?.toISOString() ?? null)
            : dto.startsAt,
        endsAt:
          dto.endsAt === undefined
            ? (previous.endsAt?.toISOString() ?? null)
            : dto.endsAt,
      });
      if (dto.planIds) await this.ensurePlans(tx, dto.planIds);
      const discount = await tx.pricingDiscount.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.value !== undefined ? { value: dto.value } : {}),
          ...(dto.startsAt !== undefined
            ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
            : {}),
          ...(dto.endsAt !== undefined
            ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.maxRedemptions !== undefined
            ? { maxRedemptions: dto.maxRedemptions }
            : {}),
          ...(dto.maxRedemptionsPerAgency !== undefined
            ? { maxRedemptionsPerAgency: dto.maxRedemptionsPerAgency }
            : {}),
          ...(dto.planIds
            ? {
                plans: {
                  deleteMany: {},
                  create: dto.planIds.map((planId) => ({ planId })),
                },
              }
            : {}),
        },
        include: { plans: { include: { plan: true } } },
      });
      const eventType =
        dto.isActive === false && previous.isActive
          ? "DISCOUNT_DISABLED"
          : dto.isActive === true && !previous.isActive
            ? "DISCOUNT_ENABLED"
            : "DISCOUNT_UPDATED";
      await this.catalogAudit(
        tx,
        actorUserId,
        eventType,
        "PricingDiscount",
        id,
        previous,
        discount,
      );
      return discount;
    });
  }

  private validateDiscount(
    dto: CreatePricingDiscountDto | UpdatePricingDiscountDto,
  ) {
    if (
      dto.type === "PERCENTAGE" &&
      dto.value !== undefined &&
      dto.value > 10000
    )
      throw new BadRequestException("Percentage discount cannot exceed 100%. ");
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt)
      throw new BadRequestException("Discount end must be after its start.");
  }

  private async ensurePlans(tx: any, planIds: string[]) {
    const unique = [...new Set(planIds)];
    const count = await tx.pricingPlan.count({ where: { id: { in: unique } } });
    if (count !== unique.length)
      throw new BadRequestException("One or more pricing plans do not exist.");
  }

  private async catalogAudit(
    tx: any,
    actorId: string,
    eventType: string,
    entityType: string,
    entityId: string,
    previous: any,
    resulting: any,
  ) {
    await Promise.all([
      tx.auditEvent.create({
        data: {
          agencyId: null,
          actorId,
          eventType,
          entityType,
          entityId,
          metadataJson: { previous, resulting },
        },
      }),
      tx.outboxEvent.create({
        data: {
          agencyId: null,
          aggregateId: entityId,
          aggregateType: entityType,
          eventType,
          payload: { actorId, previous, resulting },
        },
      }),
    ]);
  }

  async getOverview() {
    const now = new Date();
    const [
      totalAgencies,
      activeAgencies,
      trialAgencies,
      suspendedAgencies,
      totalUsers,
      totalMemberships,
      recentActivity,
    ] = await Promise.all([
      this.prisma.agency.count({ where: { deletedAt: null } }),
      this.prisma.agencySubscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }),
      this.prisma.agencySubscription.count({
        where: {
          status: SubscriptionStatus.TRIAL,
          OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }],
        },
      }),
      this.prisma.agencySubscription.count({
        where: { status: SubscriptionStatus.SUSPENDED },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.membership.count({
        where: { status: "ACTIVE", deletedAt: null },
      }),
      this.prisma.auditEvent.findMany({
        where: { eventType: { in: ACTIVITY_EVENTS } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          agencyId: true,
          eventType: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          agency: { select: { displayName: true, name: true, slug: true } },
        },
      }),
    ]);

    return {
      totalAgencies,
      entitledAgencies: activeAgencies + trialAgencies,
      activeAgencies,
      trialAgencies,
      suspendedAgencies,
      totalUsers,
      totalMemberships,
      recentActivity,
    };
  }

  async listAgencies(page: number, pageSize: number) {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const where: Prisma.AgencyWhereInput = { deletedAt: null };
    const [total, agencies] = await Promise.all([
      this.prisma.agency.count({ where }),
      this.prisma.agency.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: {
          id: true,
          name: true,
          displayName: true,
          slug: true,
          status: true,
          createdAt: true,
          subscription: true,
          _count: {
            select: {
              memberships: { where: { status: "ACTIVE", deletedAt: null } },
            },
          },
          auditEvents: {
            where: { eventType: { in: ACTIVITY_EVENTS } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, eventType: true },
          },
        },
      }),
    ]);

    return {
      items: agencies.map(({ _count, auditEvents, ...agency }) => ({
        ...agency,
        memberCount: _count.memberships,
        lastActivity: auditEvents[0] ?? null,
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async getAgency(agencyId: string) {
    const agency = await this.prisma.agency.findFirst({
      where: { id: agencyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        displayName: true,
        slug: true,
        status: true,
        createdAt: true,
        subscription: true,
      },
    });
    if (!agency) throw new NotFoundException("Agency not found.");

    const [
      members,
      campaigns,
      contentAssets,
      workflowTasks,
      completedTasks,
      activeTasks,
      clients,
      analyticsAssets,
      calendarConnections,
      recentActivity,
    ] = await Promise.all([
      this.prisma.membership.findMany({
        where: { agencyId, status: "ACTIVE", deletedAt: null },
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          status: true,
          joinedAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
          role: {
            select: {
              displayName: true,
              systemRole: { select: { key: true } },
            },
          },
        },
      }),
      this.prisma.campaign.count({ where: { agencyId, deletedAt: null } }),
      this.prisma.contentAsset.count({ where: { agencyId, deletedAt: null } }),
      this.prisma.workflowTask.count({ where: { agencyId } }),
      this.prisma.workflowTask.count({
        where: { agencyId, completedAt: { not: null } },
      }),
      this.prisma.workflowTask.count({
        where: { agencyId, completedAt: null },
      }),
      this.prisma.client.count({ where: { agencyId, deletedAt: null } }),
      this.prisma.clientAnalyticsAsset.count({
        where: { agencyId, deletedAt: null },
      }),
      this.prisma.googleCalendarConnection.count({
        where: {
          revokedAt: null,
          user: {
            memberships: {
              some: { agencyId, status: "ACTIVE", deletedAt: null },
            },
          },
        },
      }),
      this.prisma.auditEvent.findMany({
        where: { agencyId, eventType: { in: ACTIVITY_EVENTS } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          eventType: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      agency,
      metrics: {
        campaigns,
        contentAssets,
        workflowTasks,
        completedTasks,
        activeTasks,
        clients,
        analyticsAssets,
        calendarConnections,
      },
      members,
      recentActivity,
    };
  }

  async updateEntitlement(
    agencyId: string,
    dto: UpdateEntitlementDto,
    actorUserId: string,
  ) {
    const now = new Date();
    const trialEndsAt = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (
      dto.status === SubscriptionStatus.TRIAL &&
      (!trialEndsAt || trialEndsAt <= now)
    ) {
      throw new BadRequestException(
        "A trial requires a trialEndsAt date in the future.",
      );
    }
    if (dto.status === SubscriptionStatus.ACTIVE && endsAt && endsAt <= now) {
      throw new BadRequestException(
        "An active subscription end date must be in the future.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.findFirst({
        where: { id: agencyId, deletedAt: null },
        select: { id: true },
      });
      if (!agency) throw new NotFoundException("Agency not found.");
      const previous = await tx.agencySubscription.findUnique({
        where: { agencyId },
      });
      const subscription = await tx.agencySubscription.upsert({
        where: { agencyId },
        update: {
          status: dto.status,
          plan: dto.plan.trim(),
          teamLimit: null,
          teamLimitSnapshotSet: false,
          trialEndsAt,
          startsAt:
            startsAt ??
            (dto.status === SubscriptionStatus.ACTIVE
              ? (previous?.startsAt ?? now)
              : null),
          endsAt,
          version: { increment: 1 },
        },
        create: {
          agencyId,
          status: dto.status,
          plan: dto.plan.trim(),
          teamLimit: null,
          teamLimitSnapshotSet: false,
          trialEndsAt,
          startsAt:
            startsAt ?? (dto.status === SubscriptionStatus.ACTIVE ? now : null),
          endsAt,
        },
      });
      const metadata = {
        previousStatus: previous?.status ?? null,
        status: subscription.status,
        plan: subscription.plan,
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
        endsAt: subscription.endsAt?.toISOString() ?? null,
      };
      await tx.auditEvent.create({
        data: {
          agencyId,
          actorId: actorUserId,
          eventType: "AgencyEntitlementUpdated",
          entityType: "AgencySubscription",
          entityId: subscription.id,
          metadataJson: metadata,
        },
      });
      await tx.outboxEvent.create({
        data: {
          agencyId,
          aggregateId: subscription.id,
          aggregateType: "AgencySubscription",
          eventType: "AgencyEntitlementUpdated",
          payload: {
            agencyId,
            actorUserId,
            ...metadata,
            occurredAt: now.toISOString(),
          },
        },
      });
      return subscription;
    });
  }
}
