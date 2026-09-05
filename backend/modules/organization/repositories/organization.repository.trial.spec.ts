import { Prisma } from "@prisma/client";
import { OrganizationRepository } from "./organization.repository";

describe("OrganizationRepository agency trial provisioning", () => {
  const roles = [
    {
      id: "system-owner",
      key: "OWNER",
      displayName: "Owner",
      description: null,
    },
  ];

  function fixture(trialClaimCount: number) {
    const tx: any = {
      agency: {
        create: jest.fn().mockResolvedValue({
          id: "agency-1",
          name: "studio",
          displayName: "Studio",
          slug: "studio",
        }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: trialClaimCount }),
      },
      agencySubscription: { create: jest.fn().mockResolvedValue({}) },
      systemRole: { findMany: jest.fn().mockResolvedValue(roles) },
      role: {
        create: jest
          .fn()
          .mockResolvedValue({ id: "owner-role", agencyId: "agency-1" }),
      },
      membership: {
        create: jest.fn().mockResolvedValue({ id: "membership-1" }),
      },
      session: { update: jest.fn() },
      outboxEvent: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    return { repository: new OrganizationRepository(prisma), prisma, tx };
  }

  it("atomically claims and starts a fourteen-day trial for the first agency", async () => {
    const { repository, prisma, tx } = fixture(1);
    await repository.createAgencyWithOwner(
      "Studio",
      "studio",
      "user-1",
      "auth-1",
    );

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", trialAvailedAt: null },
      data: {
        trialAvailedAt: expect.any(Date),
        trialAgencyId: "agency-1",
      },
    });
    const subscription = tx.agencySubscription.create.mock.calls[0][0].data;
    expect(subscription.status).toBe("TRIAL");
    expect(subscription.plan).toBe("TRIAL");
    expect(
      subscription.trialEndsAt.getTime() - subscription.startsAt.getTime(),
    ).toBe(14 * 24 * 60 * 60 * 1000);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("creates no second trial when the permanent claim already exists", async () => {
    const { repository, tx } = fixture(0);
    await repository.createAgencyWithOwner(
      "Second Studio",
      "second-studio",
      "user-1",
      "auth-1",
    );

    expect(tx.agencySubscription.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    expect(tx.membership.create).toHaveBeenCalled();
  });
});
