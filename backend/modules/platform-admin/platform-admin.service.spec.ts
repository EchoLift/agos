import { PricingDiscountType, SubscriptionStatus } from "@prisma/client";
import { PlatformAdminService } from "./platform-admin.service";

describe("PlatformAdminService entitlement updates", () => {
  it("allows a platform operation to update entitlement atomically with audit and outbox records", async () => {
    const tx = {
      agency: { findFirst: jest.fn().mockResolvedValue({ id: "agency-1" }) },
      agencySubscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: "sub-1",
          agencyId: "agency-1",
          status: "ACTIVE",
          plan: "MANUAL",
          trialEndsAt: null,
          endsAt: null,
        }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new PlatformAdminService(prisma as never);
    await expect(
      service.updateEntitlement(
        "agency-1",
        { status: SubscriptionStatus.ACTIVE, plan: "MANUAL" },
        "admin-1",
      ),
    ).resolves.toMatchObject({ status: "ACTIVE" });
    expect(tx.agencySubscription.upsert).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
    expect(tx.outboxEvent.create).toHaveBeenCalled();
  });

  it("creates a database-backed plan and records a global catalog audit", async () => {
    const plan = {
      id: "plan-1",
      code: "ONE_MONTH",
      name: "1 Month",
      durationMonths: 1,
      priceAmountMinor: 149900,
      currency: "INR",
      teamLimit: 25,
      displayOrder: 5,
      isActive: true,
    };
    const tx = {
      pricingPlan: { create: jest.fn().mockResolvedValue(plan) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new PlatformAdminService(prisma as never);

    await expect(
      service.createPricingPlan(
        {
          code: "one_month",
          name: "1 Month",
          durationMonths: 1,
          priceAmountMinor: 149900,
          teamLimit: 25,
          displayOrder: 5,
          isActive: true,
        },
        "admin-1",
      ),
    ).resolves.toEqual(plan);
    expect(tx.pricingPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "ONE_MONTH", currency: "INR" }),
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agencyId: null,
        actorId: "admin-1",
        eventType: "PRICING_PLAN_CREATED",
      }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalled();
  });

  it("rejects invalid discount schedules before writing", async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new PlatformAdminService(prisma as never);
    await expect(
      service.createPricingDiscount(
        {
          name: "Invalid",
          type: PricingDiscountType.PERCENTAGE,
          value: 2000,
          startsAt: "2026-10-25T00:00:00.000Z",
          endsAt: "2026-10-15T00:00:00.000Z",
          isActive: true,
          planIds: ["11111111-1111-4111-8111-111111111111"],
        },
        "admin-1",
      ),
    ).rejects.toThrow("Discount end must be after its start.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
