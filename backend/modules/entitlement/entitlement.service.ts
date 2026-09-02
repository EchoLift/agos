import { Injectable } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";

export type AgencyAccessDecision = {
  allowed: boolean;
  status: SubscriptionStatus | null;
  plan: string | null;
  trialEndsAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  reason: string | null;
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAgencyAccess(
    agencyId: string,
    now = new Date(),
  ): Promise<AgencyAccessDecision> {
    const subscription = await this.prisma.agencySubscription.findUnique({
      where: { agencyId },
      select: {
        status: true,
        plan: true,
        trialEndsAt: true,
        startsAt: true,
        endsAt: true,
      },
    });

    return this.evaluate(subscription, now);
  }

  evaluate(
    subscription: {
      status: SubscriptionStatus;
      plan: string;
      trialEndsAt: Date | null;
      startsAt: Date | null;
      endsAt: Date | null;
    } | null,
    now = new Date(),
  ): AgencyAccessDecision {
    if (!subscription) {
      return this.decision(null, false, "NO_ENTITLEMENT");
    }

    if (subscription.status === SubscriptionStatus.TRIAL) {
      const allowed =
        subscription.trialEndsAt === null || subscription.trialEndsAt > now;
      return this.decision(
        subscription,
        allowed,
        allowed ? null : "TRIAL_EXPIRED",
      );
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      const allowed = subscription.endsAt === null || subscription.endsAt > now;
      return this.decision(
        subscription,
        allowed,
        allowed ? null : "SUBSCRIPTION_EXPIRED",
      );
    }

    return this.decision(subscription, false, subscription.status);
  }

  private decision(
    subscription: {
      status: SubscriptionStatus;
      plan: string;
      trialEndsAt: Date | null;
      startsAt: Date | null;
      endsAt: Date | null;
    } | null,
    allowed: boolean,
    reason: string | null,
  ): AgencyAccessDecision {
    return {
      allowed,
      status: subscription?.status ?? null,
      plan: subscription?.plan ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      startsAt: subscription?.startsAt ?? null,
      endsAt: subscription?.endsAt ?? null,
      reason,
    };
  }
}
