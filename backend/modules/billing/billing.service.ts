import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentOrderStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@packages/database/prisma.service";
import { CryptoService } from "@modules/auth/services/crypto.service";
import { BILLING_ROLE_KEYS, TRIAL_TEAM_LIMIT } from "./billing.constants";
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
              planCodeSnapshot: true,
              planNameSnapshot: true,
              amountMinor: true,
              baseAmountMinor: true,
              discountAmountMinor: true,
              discountNameSnapshot: true,
              currency: true,
              status: true,
              cashfreeOrderId: true,
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

    const reconciledPaymentOrders = await Promise.all(
      paymentOrders.map((order) => this.reconcilePendingOrder(order)),
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
      teamLimit: membership.agency.subscription?.teamLimitSnapshotSet
        ? membership.agency.subscription.teamLimit
        : this.teamLimit(membership.agency.subscription?.plan),
      renewalAvailableAt: this.renewalAvailableAt(
        membership.agency.subscription,
      ),
      paymentHistory: reconciledPaymentOrders.filter(
        (order) =>
          order.agencyId === membership.agencyId &&
          ![PaymentOrderStatus.CREATING, PaymentOrderStatus.PENDING].includes(
            order.status,
          ),
      ),
    }));
  }
  async plans(userId?: string, agencyId?: string) {
    if (agencyId && userId) await this.billingMembership(agencyId, userId);
    const plans = await this.prisma.pricingPlan.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: {
        discounts: {
          include: { discount: true },
        },
      },
    });
    return Promise.all(
      plans.map(async (plan) => {
        const discount = await this.bestDiscount(
          this.prisma,
          plan,
          agencyId,
          false,
        );
        return this.publicPlan(plan, discount);
      }),
    );
  }
  async createOrder(agencyId: string, userId: string, planId: string) {
    const membership = await this.billingMembership(agencyId, userId);
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authUser: { select: { emailEncrypted: true } } },
    });
    if (!user) throw new NotFoundException();
    const orderId = `agencie-${crypto.randomUUID()}`;
    const internal = await this.prisma.$transaction(
      async (tx) => {
        const plan = await tx.pricingPlan.findFirst({
          where: { id: planId, isActive: true, archivedAt: null },
          include: { discounts: { include: { discount: true } } },
        });
        if (!plan)
          throw new BadRequestException(
            "Selected pricing plan is unavailable.",
          );
        const subscription = await tx.agencySubscription.findUnique({
          where: { agencyId },
        });
        const available = this.renewalAvailableAt(subscription);
        if (available && available > now)
          throw new BadRequestException({
            message: "Renewal is not available yet.",
            renewalAvailableAt: available,
          });
        const count = await tx.membership.count({
          where: { agencyId, status: "ACTIVE", deletedAt: null },
        });
        if (plan.teamLimit !== null && count > plan.teamLimit)
          throw new BadRequestException({
            message:
              "Selected billing plan does not support the current team size.",
            currentActiveMembers: count,
            selectedPlanLimit: plan.teamLimit,
            membersToRemove: count - plan.teamLimit,
          });
        const discount = await this.bestDiscount(tx, plan, agencyId, true);
        const pricing = this.calculatePrice(plan.priceAmountMinor, discount);
        const startsAt = this.activationBase(subscription, now);
        const endsAt = this.addMonths(startsAt, plan.durationMonths);
        const legacyPeriods = new Set([
          "THREE_MONTHS",
          "SIX_MONTHS",
          "TWELVE_MONTHS",
        ]);
        return tx.agencyPaymentOrder.create({
          data: {
            agencyId,
            payerUserId: userId,
            payerMembershipId: membership.id,
            period: legacyPeriods.has(plan.code) ? (plan.code as any) : null,
            pricingPlanId: plan.id,
            planCodeSnapshot: plan.code,
            planNameSnapshot: plan.name,
            durationMonths: plan.durationMonths,
            amountMinor: pricing.finalAmountMinor,
            baseAmountMinor: plan.priceAmountMinor,
            discountAmountMinor: pricing.discountAmountMinor,
            discountId: discount?.id ?? null,
            discountNameSnapshot: discount?.name ?? null,
            currency: plan.currency,
            teamLimitSnapshot: plan.teamLimit,
            entitlementStartsAt: startsAt,
            entitlementEndsAt: endsAt,
            cashfreeOrderId: orderId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    try {
      const cf = await this.cashfree.createOrder(
        {
          order_id: orderId,
          order_amount: internal.amountMinor / 100,
          order_currency: internal.currency,
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
          order_expiry_time: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(),
          order_note: `AGENCIE ${internal.planCodeSnapshot}`,
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

  private publicPlan(plan: any, discount: any) {
    const pricing = this.calculatePrice(plan.priceAmountMinor, discount);
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      durationMonths: plan.durationMonths,
      priceAmountMinor: plan.priceAmountMinor,
      currency: plan.currency,
      teamLimit: plan.teamLimit,
      displayOrder: plan.displayOrder,
      discount: discount
        ? {
            name: discount.name,
            amountMinor: pricing.discountAmountMinor,
          }
        : null,
      finalAmountMinor: pricing.finalAmountMinor,
    };
  }

  private calculatePrice(baseAmountMinor: number, discount?: any) {
    if (!discount)
      return { discountAmountMinor: 0, finalAmountMinor: baseAmountMinor };
    const amount =
      discount.type === "PERCENTAGE"
        ? Number(
            (BigInt(baseAmountMinor) * BigInt(discount.value) + 5000n) / 10000n,
          )
        : discount.value;
    const discountAmountMinor = Math.min(baseAmountMinor, Math.max(0, amount));
    return {
      discountAmountMinor,
      finalAmountMinor: baseAmountMinor - discountAmountMinor,
    };
  }

  private async bestDiscount(
    db: any,
    plan: any,
    agencyId?: string,
    reserve = false,
  ) {
    const now = new Date();
    const candidates = plan.discounts
      .map((item: any) => item.discount)
      .filter(
        (discount: any) =>
          discount.isActive &&
          (!discount.startsAt || discount.startsAt <= now) &&
          (!discount.endsAt || discount.endsAt > now),
      );
    const eligible: any[] = [];
    for (const discount of candidates) {
      // Cashfree orders expire after 30 minutes. Pending orders reserve scarce
      // promotions only for that window, so abandoned checkouts do not consume
      // redemption capacity permanently.
      const redemptionWhere = reserve
        ? {
            OR: [
              { status: "PAID" },
              {
                status: { in: ["CREATING", "PENDING"] },
                createdAt: { gt: new Date(now.getTime() - 30 * 60 * 1000) },
              },
            ],
          }
        : { status: "PAID" };
      const [globalCount, agencyCount] = await Promise.all([
        discount.maxRedemptions
          ? db.agencyPaymentOrder.count({
              where: { discountId: discount.id, ...redemptionWhere },
            })
          : 0,
        discount.maxRedemptionsPerAgency && agencyId
          ? db.agencyPaymentOrder.count({
              where: { discountId: discount.id, agencyId, ...redemptionWhere },
            })
          : 0,
      ]);
      if (
        (discount.maxRedemptions && globalCount >= discount.maxRedemptions) ||
        (discount.maxRedemptionsPerAgency &&
          agencyId &&
          agencyCount >= discount.maxRedemptionsPerAgency)
      )
        continue;
      eligible.push(discount);
    }
    return eligible.sort((a, b) => {
      const aFinal = this.calculatePrice(
        plan.priceAmountMinor,
        a,
      ).finalAmountMinor;
      const bFinal = this.calculatePrice(
        plan.priceAmountMinor,
        b,
      ).finalAmountMinor;
      return aFinal - bFinal || a.id.localeCompare(b.id);
    })[0];
  }
  async order(userId: string, id: string) {
    let o = await this.prisma.agencyPaymentOrder.findUnique({
      where: { id },
      include: {
        agency: { select: { displayName: true, name: true, slug: true } },
      },
    });
    if (!o) throw new NotFoundException();
    await this.billingMembership(o.agencyId, userId);
    o = await this.reconcilePendingOrder(o, {
      agency: { select: { displayName: true, name: true, slug: true } },
    });
    return { ...o, paymentSessionId: undefined };
  }

  private async reconcilePendingOrder(order: any, include?: any) {
    if (order.status !== PaymentOrderStatus.PENDING) return order;
    try {
      const payments = await this.cashfree.getOrderPayments(
        order.cashfreeOrderId,
      );
      const latest = [...payments].sort((a, b) => {
        const timestamp = (payment: (typeof payments)[number]) => {
          const value = payment.payment_completion_time ?? payment.payment_time;
          const parsed = value ? new Date(value).getTime() : 0;
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const timeDifference = timestamp(b) - timestamp(a);
        if (timeDifference) return timeDifference;
        return Number(b.cf_payment_id ?? 0) - Number(a.cf_payment_id ?? 0);
      })[0];
      const status =
        latest?.payment_status === "FAILED"
          ? PaymentOrderStatus.FAILED
          : ["USER_DROPPED", "CANCELLED", "VOID"].includes(
                latest?.payment_status,
              )
            ? PaymentOrderStatus.CANCELLED
            : null;
      if (!status) return order;
      return await this.prisma.agencyPaymentOrder.update({
        where: { id: order.id },
        data: {
          status,
          providerFailureCode: latest?.error_details?.error_code,
          providerFailureReason:
            latest?.error_details?.error_description ?? latest?.payment_message,
          processedAt: new Date(),
        },
        ...(include ? { include } : {}),
      });
    } catch {
      // Webhooks remain authoritative; a later read can safely retry.
      return order;
    }
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
        if (o.discountId) {
          await tx.pricingDiscountRedemption.create({
            data: {
              discountId: o.discountId,
              agencyId: o.agencyId,
              paymentOrderId: o.id,
            },
          });
        }
        await tx.agencySubscription.upsert({
          where: { agencyId: o.agencyId },
          create: {
            agencyId: o.agencyId,
            status: "ACTIVE",
            plan: o.planCodeSnapshot ?? o.period ?? "PAID",
            startsAt: start,
            endsAt: end,
            teamLimit: o.teamLimitSnapshot,
            teamLimitSnapshotSet: true,
          },
          update: {
            status: "ACTIVE",
            plan: o.planCodeSnapshot ?? o.period ?? "PAID",
            startsAt: sub?.startsAt ?? now,
            endsAt: end,
            teamLimit: o.teamLimitSnapshot,
            teamLimitSnapshotSet: true,
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
              planCode: o.planCodeSnapshot ?? o.period,
              planName: o.planNameSnapshot,
              amountMinor: o.amountMinor,
              baseAmountMinor: o.baseAmountMinor,
              discountAmountMinor: o.discountAmountMinor,
              discountId: o.discountId,
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
              planCode: o.planCodeSnapshot ?? o.period,
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
    if (plan === "THREE_MONTHS") return 50;
    if (plan === "SIX_MONTHS") return 120;
    return null;
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
