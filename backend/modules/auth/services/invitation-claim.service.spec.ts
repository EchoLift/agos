import { InvitationClaimService } from "./invitation-claim.service";
import { PrismaService } from "@packages/database/prisma.service";

describe("InvitationClaimService", () => {
  let service: InvitationClaimService;
  let tx: any;

  beforeEach(() => {
    tx = {
      invitation: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      membership: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      membershipRole: {
        createMany: jest.fn(),
      },
      outboxEvent: {
        createMany: jest.fn(),
      },
    };

    service = new InvitationClaimService({
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService);
  });

  it("claims a pending invitation by creating membership, roles, and outbox events in one transaction", async () => {
    tx.invitation.findMany.mockResolvedValue([
      {
        id: "inv-1",
        agencyId: "agency-1",
        roleId: "role-writer",
        roles: [{ roleId: "role-writer" }, { roleId: "role-editor" }],
      },
    ]);
    tx.invitation.updateMany.mockResolvedValue({ count: 1 });
    tx.membership.findUnique.mockResolvedValue(null);
    tx.membership.create.mockResolvedValue({
      id: "mem-1",
      roleId: "role-writer",
    });

    const result = await service.claimPendingInvitationsForUser({
      authUserId: "auth-1",
      userId: "user-1",
      emailHash: "email-hash",
      correlationId: "corr-1",
      requestId: "req-1",
    });

    expect(result).toEqual({ claimed: 1, membershipIds: ["mem-1"] });
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agencyId: "agency-1",
        userId: "user-1",
        roleId: "role-writer",
        status: "ACTIVE",
      }),
    });
    expect(tx.membershipRole.createMany).toHaveBeenCalledWith({
      data: [
        { membershipId: "mem-1", roleId: "role-writer" },
        { membershipId: "mem-1", roleId: "role-editor" },
      ],
      skipDuplicates: true,
    });
    expect(tx.outboxEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ eventType: "InvitationAccepted" }),
        expect.objectContaining({ eventType: "MemberJoined" }),
      ]),
    });
  });

  it("is idempotent when another login already accepted the invitation", async () => {
    tx.invitation.findMany.mockResolvedValue([
      {
        id: "inv-1",
        agencyId: "agency-1",
        roleId: "role-writer",
        roles: [],
      },
    ]);
    tx.invitation.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.claimPendingInvitationsForUser({
      authUserId: "auth-1",
      userId: "user-1",
      emailHash: "email-hash",
    });

    expect(result).toEqual({ claimed: 0, membershipIds: [] });
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(tx.membershipRole.createMany).not.toHaveBeenCalled();
    expect(tx.outboxEvent.createMany).not.toHaveBeenCalled();
  });

  it("adds missing role rows without duplicating an existing membership", async () => {
    tx.invitation.findMany.mockResolvedValue([
      {
        id: "inv-1",
        agencyId: "agency-1",
        roleId: "role-editor",
        roles: [{ roleId: "role-editor" }, { roleId: "role-dop" }],
      },
    ]);
    tx.invitation.updateMany.mockResolvedValue({ count: 1 });
    tx.membership.findUnique.mockResolvedValue({
      id: "mem-1",
      roleId: "role-editor",
      status: "ACTIVE",
      deletedAt: null,
    });

    const result = await service.claimPendingInvitationsForUser({
      authUserId: "auth-1",
      userId: "user-1",
      emailHash: "email-hash",
    });

    expect(result.claimed).toBe(1);
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(tx.membershipRole.createMany).toHaveBeenCalledWith({
      data: [
        { membershipId: "mem-1", roleId: "role-editor" },
        { membershipId: "mem-1", roleId: "role-dop" },
      ],
      skipDuplicates: true,
    });
  });
});
