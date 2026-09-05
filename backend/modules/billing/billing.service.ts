import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BillingPeriod,
  PaymentOrderStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@packages/database/prisma.service";
import { CryptoService } from "@modules/auth/services/crypto.service";
import {
  BILLING_PERIODS,
  BILLING_ROLE_KEYS,
  TRIAL_TEAM_LIMIT,
} from "./billing.constants";
import { CashfreeService } from "./cashfree.service";
import * as crypto from "node:crypto";

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private cashfree: CashfreeService,
    private cryptoService: CryptoService,
    private config: ConfigService,
  ) {}
  private roleKeys(m: any) {
    return (
      m.roles?.length
        ? m.roles.map((x: any) => x.role.systemRole.key)
        : [m.role.systemRole.key]
    ) as string[];
  }
  private async billingMembership(agencyId: string, userId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { agencyId_userId: { agencyId, userId } },
      include: {
        role: { include: { systemRole: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
      },
    });
    if (
      !m ||
      m.status !== "ACTIVE" ||
      m.deletedAt ||
      !this.roleKeys(m).some((x) => BILLING_ROLE_KEYS.has(x))
    )
      throw new ForbiddenException(
        "Active OWNER or FINANCE membership required.",
      );
    return m;
  }
  async listEligible(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: "ACTIVE", deletedAt: null },
      include: {
        agency: { include: { subscription: true } },
        role: { include: { systemRole: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
      },
    });
    const eligible = memberships.filter((membership) =>
      this.roleKeys(membership).some((role) => BILLING_ROLE_KEYS.has(role)),
    );
    const agencyIds = eligible.map((membership) => membership.agencyId);
    const [memberCounts, paymentOrders] = agencyIds.length
      ? await Promise.all([
          this.prisma.membership.groupBy({
            by: ["agencyId"],
            where: {
              agencyId: { in: agencyIds },
              status: "ACTIVE",
              deletedAt: null,
            },
            _count: { _all: true },
          }),
          this.prisma.agencyPaymentOrder.findMany({
            where: { agencyId: { in: agencyIds } },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              agencyId: true,
              period: true,
              amountMinor: true,
              currency: true,
              status: true,
              paidAt: true,
              entitlementEndsAt: true,
              createdAt: true,
            },
          }),
        ])
      : [[], []];
    const counts = new Map(
      memberCounts.map((row) => [row.agencyId, row._count._all]),
    );

    return eligible.map((membership) => ({
      agency: {
        id: membership.agency.id,
        name: membership.agency.displayName || membership.agency.name,
        slug: membership.agency.slug,
      },
      role: this.roleKeys(membership).find((role) =>
        BILLING_ROLE_KEYS.has(role),
      ),
      subscription: membership.agency.subscription,
      activeMembers: counts.get(membership.agencyId) ?? 0,
      teamLimit: this.teamLimit(membership.agency.subscription?.plan),
      renewalAvailableAt: this.renewalAvailableAt(
        membership.agency.subscription,
      ),
      paymentHistory: paymentOrders.filter(
        (order) => order.agencyId === membership.agencyId,
      ),
    }));
  }
  plans() {
    return Object.entries(BILLING_PERIODS).map(([period, p]) => ({
      period,
      ...p,
      currency: "INR",
    }));
  }
  async createOrder(agencyId: string, userId: string, period: BillingPeriod) {
    const membership = await this.billingMembership(agencyId, userId);
    const price = BILLING_PERIODS[period];
    const subscription = await this.prisma.agencySubscription.findUnique({
      where: { agencyId },
    });
    const now = new Date();
    const available = this.renewalAvailableAt(subscription);
    if (available && available > now)
      throw new BadRequestException({
        message: "Renewal is not available yet.",
        renewalAvailableAt: available,
      });
    const count = await this.prisma.membership.count({
      where: { agencyId, status: "ACTIVE", deletedAt: null },
    });
    if (price.teamLimit !== null && count > price.teamLimit)
      throw new BadRequestException({
        message:
          "Selected billing period does not support the current team size.",
        currentActiveMembers: count,
        selectedPlanLimit: price.teamLimit,
        membersToRemove: count - price.teamLimit,
      });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authUser: { select: { emailEncrypted: true } } },
    });
    if (!user) throw new NotFoundException();
    const orderId = `agencie-${crypto.randomUUID()}`;
    const startsAt = this.activationBase(subscription, now);
    const endsAt = this.addMonths(startsAt, price.months);
    const internal = await this.prisma.agencyPaymentOrder.create({
      data: {
        agencyId,
        payerUserId: userId,
        payerMembershipId: membership.id,
        period,
        durationMonths: price.months,
        amountMinor: price.amountMinor,
        currency: "INR",
        teamLimitSnapshot: price.teamLimit,
        entitlementStartsAt: startsAt,
        entitlementEndsAt: endsAt,
        cashfreeOrderId: orderId,
      },
    });
    try {
      const cf = await this.cashfree.createOrder(
        {
          order_id: orderId,
          order_amount: price.amountMinor / 100,
          order_currency: "INR",
          customer_details: {
            customer_id: userId,
            customer_phone: user.mobileNumberEncrypted
              ? this.cryptoService.decrypt(user.mobileNumberEncrypted)
              : "9999999999",
            customer_email: this.cryptoService.decrypt(
              user.authUser.emailEncrypted,
            ),
            customer_name: user.name || "AGENCIE customer",
          },
          order_meta: {
            return_url: `${this.config.get("FRONTEND_URL") || "http://localhost:3000"}/billing/return?orderId=${internal.id}`,
          },
          order_note: `AGENCIE ${period}`,
        },
        internal.id,
      );
      await this.prisma.agencyPaymentOrder.update({
        where: { id: internal.id },
        data: {
          cashfreeCfOrderId: String(cf.cf_order_id),
          paymentSessionId: cf.payment_session_id,
          status: "PENDING",
        },
      });
      return {
        orderId: internal.id,
        paymentSessionId: cf.payment_session_id,
        environment: this.cashfree.environment,
      };
    } catch (e) {
      await this.prisma.agencyPaymentOrder.update({
        where: { id: internal.id },
        data: {
          status: "FAILED",
          providerFailureReason: "ORDER_CREATION_FAILED",
        },
      });
      throw e;
    }
  }
  async order(userId: string, id: string) {
    let o = await this.prisma.agencyPaymentOrder.findUnique({
      where: { id },
      include: { agency: { select: { displayName: true, name: true } } },
    });
    if (!o) throw new NotFoundException();
    await this.billingMembership(o.agencyId, userId);
    if (o.status === PaymentOrderStatus.PENDING) {
      try {
        const payments = await this.cashfree.getOrderPayments(
          o.cashfreeOrderId,
        );
        const latest = [...payments]
          .filter((payment) => payment.payment_time)
          .sort(
            (a, b) =>
              new Date(b.payment_time!).getTime() -
              new Date(a.payment_time!).getTime(),
          )[0];
        const status =
          latest?.payment_status === "FAILED"
            ? PaymentOrderStatus.FAILED
            : ["USER_DROPPED", "CANCELLED", "VOID"].includes(
                  latest?.payment_status,
                )
              ? PaymentOrderStatus.CANCELLED
              : null;
        if (status) {
          o = await this.prisma.agencyPaymentOrder.update({
            where: { id: o.id },
            data: {
              status,
              providerFailureCode: latest?.error_details?.error_code,
              providerFailureReason:
                latest?.error_details?.error_description ??
                latest?.payment_message,
              processedAt: new Date(),
            },
            include: {
              agency: { select: { displayName: true, name: true } },
            },
          });
        }
      } catch {
        // Webhooks remain authoritative; keep polling if provider lookup fails.
      }
    }
    return { ...o, paymentSessionId: undefined };
  }
  async webhook(payload: any) {
    const orderId = payload?.data?.order?.order_id;
    const providerOrder = payload?.data?.order;
    const payment = payload?.data?.payment;
    if (!orderId) return { accepted: true };
    if (payload?.type !== "PAYMENT_SUCCESS_WEBHOOK") {
      const status =
        payload?.type === "PAYMENT_USER_DROPPED_WEBHOOK"
          ? PaymentOrderStatus.CANCELLED
          : payload?.type === "PAYMENT_FAILED_WEBHOOK"
            ? PaymentOrderStatus.FAILED
            : null;
      if (status)
        await this.prisma.agencyPaymentOrder.updateMany({
          where: {
            cashfreeOrderId: orderId,
            status: { not: PaymentOrderStatus.PAID },
          },
          data: {
            status,
            providerFailureCode: payload?.data?.error_details?.error_code,
            providerFailureReason:
              payload?.data?.error_details?.error_description ??
              payment?.payment_message,
            processedAt: new Date(),
          },
        });
      return { accepted: true };
    }
    if (payment?.payment_status !== "SUCCESS") return { accepted: true };
    return this.prisma.$transaction(
      async (tx) => {
        const o = await tx.agencyPaymentOrder.findUnique({
          where: { cashfreeOrderId: orderId },
        });
        if (!o) throw new NotFoundException();
        if (o.status === "PAID") return { accepted: true, duplicate: true };
        if (
          Math.round(Number(payment.payment_amount) * 100) !== o.amountMinor ||
          payment.payment_currency !== o.currency ||
          Math.round(Number(providerOrder?.order_amount) * 100) !==
            o.amountMinor ||
          providerOrder?.order_currency !== o.currency
        )
          throw new BadRequestException("Payment details do not match order.");
        const now = new Date();
        const sub = await tx.agencySubscription.findUnique({
          where: { agencyId: o.agencyId },
        });
        const start = this.activationBase(sub, now);
        const end = this.addMonths(start, o.durationMonths);
        await tx.agencyPaymentOrder.update({
          where: { id: o.id },
          data: {
            status: "PAID",
            cashfreePaymentId: String(payment.cf_payment_id),
            paidAt: now,
            processedAt: now,
            entitlementStartsAt: start,
            entitlementEndsAt: end,
          },
        });
        await tx.agencySubscription.upsert({
          where: { agencyId: o.agencyId },
          create: {
            agencyId: o.agencyId,
            status: "ACTIVE",
            plan: o.period,
            startsAt: start,
            endsAt: end,
          },
          update: {
            status: "ACTIVE",
            plan: o.period,
            startsAt: sub?.startsAt ?? now,
            endsAt: end,
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            agencyId: o.agencyId,
            actorId: o.payerUserId,
            eventType:
              sub?.status === "ACTIVE"
                ? "SubscriptionExtended"
                : "SubscriptionActivated",
            entityType: "AgencyPaymentOrder",
            entityId: o.id,
            metadataJson: {
              source: "CASHFREE",
              period: o.period,
              amountMinor: o.amountMinor,
              currency: o.currency,
              paymentOrderId: o.id,
              previousStatus: sub?.status ?? null,
              endsAt: end.toISOString(),
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            agencyId: o.agencyId,
            aggregateId: o.id,
            aggregateType: "AgencyPaymentOrder",
            eventType: "PaymentSucceeded",
            payload: {
              agencyId: o.agencyId,
              paymentOrderId: o.id,
              period: o.period,
              endsAt: end.toISOString(),
            },
          },
        });
        return { accepted: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private teamLimit(plan?: string | null) {
    if (plan === "TRIAL") return TRIAL_TEAM_LIMIT;
    if (!plan) return null;
    return (BILLING_PERIODS as any)[plan]?.teamLimit ?? null;
  }
  private renewalAvailableAt(s: any) {
    if (s?.status !== SubscriptionStatus.ACTIVE || !s.endsAt) return null;
    const d = new Date(s.endsAt);
    d.setUTCDate(d.getUTCDate() - 21);
    return d;
  }
  private activationBase(s: any, now: Date) {
    return s?.status === SubscriptionStatus.ACTIVE && s.endsAt && s.endsAt > now
      ? new Date(s.endsAt)
      : now;
  }
  private addMonths(date: Date, months: number) {
    const d = new Date(date);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d;
  }
}
