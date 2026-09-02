import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { UpdateEntitlementDto } from "./dto/update-entitlement.dto";

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
