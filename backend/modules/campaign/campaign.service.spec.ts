import { ConflictException, ForbiddenException } from "@nestjs/common";
import { CampaignService } from "./campaign.service";
import { DomainEvents } from "@packages/events/domain-event";

describe("CampaignService", () => {
  let service: CampaignService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      campaign: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      client: {
        findUnique: jest.fn(),
      },
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue({}),
    };

    service = new CampaignService(prisma, eventBus);
  });

  it("creates a draft campaign and publishes a created event", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
    });
    prisma.campaign.count.mockResolvedValue(20);
    prisma.campaign.create.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      clientId: "client-1",
      name: "August Growth Campaign",
      campaignCode: "CMP-021",
      status: "DRAFT",
    });

    const campaign = await service.create(
      {
        agencyId: "agency-1",
        clientId: "client-1",
        name: "August Growth Campaign",
        objective: "Grow qualified leads",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
      "agency-1",
      "user-1",
    );

    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignCode: "CMP-021",
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.CampaignCreated,
      expect.objectContaining({
        agencyId: "agency-1",
        actorId: "user-1",
        payload: expect.objectContaining({ campaignId: "campaign-1" }),
      }),
    );
    expect(campaign).toEqual(expect.objectContaining({ id: "campaign-1" }));
  });

  it("fails when the client does not belong to the current agency", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "client-2",
      agencyId: "other-agency",
    });

    await expect(
      service.create(
        {
          agencyId: "agency-1",
          clientId: "client-2",
          name: "Bad Campaign",
          objective: "Test",
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        },
        "agency-1",
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("filters campaign lists to the assigned client for CLIENT users", async () => {
    prisma.campaign.findMany.mockResolvedValue([]);

    await service.findMany("agency-1", {
      authUserId: "auth-client",
      userId: "user-client",
      sessionId: "session-1",
      agencyId: "agency-1",
      membershipId: "mem-client",
      clientId: "client-1",
      role: "CLIENT",
      roles: ["CLIENT"],
      permissions: [],
    });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agencyId: "agency-1",
          clientId: "client-1",
          status: { not: "DELETED" },
        }),
      }),
    );
  });

  it("blocks CLIENT users from fetching another client's campaign by ID", async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      clientId: "client-other",
      status: "ACTIVE",
    });

    await expect(
      service.findById("campaign-1", "agency-1", {
        authUserId: "auth-client",
        userId: "user-client",
        sessionId: "session-1",
        agencyId: "agency-1",
        membershipId: "mem-client",
        clientId: "client-1",
        role: "CLIENT",
        roles: ["CLIENT"],
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("activates a draft campaign and publishes an activated event", async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      status: "DRAFT",
      version: 2,
    });
    prisma.campaign.update.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      status: "ACTIVE",
      version: 3,
    });

    const campaign = await service.activate(
      "campaign-1",
      { version: 2 },
      "agency-1",
      "user-1",
    );

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: "campaign-1", version: 2 },
      data: { status: "ACTIVE", version: { increment: 1 } },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.CampaignActivated,
      expect.objectContaining({
        agencyId: "agency-1",
        actorId: "user-1",
        payload: expect.objectContaining({
          campaignId: "campaign-1",
          previousStatus: "DRAFT",
          status: "ACTIVE",
        }),
      }),
    );
    expect(campaign.status).toBe("ACTIVE");
  });
});
