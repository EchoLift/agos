import { SubscriptionStatus } from "@prisma/client";
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
});
