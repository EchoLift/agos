import { ContentService } from "./content.service";
import { DomainEvents } from "@packages/events/domain-event";

describe("ContentService", () => {
  let service: ContentService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
      campaign: { findUnique: jest.fn() },
      client: { findUnique: jest.fn() },
      membership: { findFirst: jest.fn() },
      contentAsset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      workflowInstance: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      workflowTask: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      workflowTransition: { create: jest.fn() },
      assignmentHistory: { create: jest.fn() },
    };
    eventBus = { publish: jest.fn().mockResolvedValue({}) };
    service = new ContentService(prisma, eventBus);
  });

  it("creates a content asset under the current agency and publishes an event", async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      clientId: "client-1",
      endDate: new Date("2026-08-20T12:00:00.000Z"),
      teamAssignments: [
        { membershipId: "writer-1", assignmentRole: "WRITER" },
        { membershipId: "manager-1", assignmentRole: "CAMPAIGN_MANAGER" },
      ],
      publishingSchedules: [],
    });
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
    });
    prisma.contentAsset.create.mockResolvedValue({
      id: "asset-1",
      agencyId: "agency-1",
      clientId: "client-1",
      campaignId: "campaign-1",
      displayCode: "REEL-TEST",
      type: "REEL",
      title: "Launch Reel",
      brief: "Need a sharp launch reel",
      status: "ACTIVE",
    });
    prisma.membership.findFirst.mockResolvedValue({ id: "member-ok" });
    prisma.workflowInstance.create.mockResolvedValue({
      id: "workflow-1",
      agencyId: "agency-1",
    });
    prisma.workflowTask.create.mockResolvedValue({
      id: "task-1",
      ownerMembershipId: "writer-1",
    });

    const asset = await service.create(
      {
        clientId: "client-1",
        campaignId: "campaign-1",
        displayCode: "REEL-TEST",
        type: "REEL" as any,
        title: "Launch Reel",
        brief: "Need a sharp launch reel",
      },
      "agency-1",
      {
        agencyId: "agency-1",
        userId: "user-1",
        membershipId: "manager-1",
      } as any,
    );

    expect(prisma.contentAsset.create).toHaveBeenCalled();
    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerMembershipId: "writer-1",
          status: "TODO",
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ContentAssetCreated,
      expect.objectContaining({ agencyId: "agency-1" }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ContentAssigned,
      expect.objectContaining({
        payload: expect.objectContaining({
          assigneeId: "writer-1",
          inheritedFromCampaignRole: "WRITER",
        }),
      }),
    );
    expect(asset).toEqual(expect.objectContaining({ id: "asset-1" }));
  });

  it("requires one campaign writer when creating campaign content", async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      clientId: "client-1",
      endDate: new Date("2026-08-20T12:00:00.000Z"),
      teamAssignments: [],
      publishingSchedules: [],
    });
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
    });

    await expect(
      service.create(
        {
          clientId: "client-1",
          campaignId: "campaign-1",
          type: "REEL" as any,
          title: "Launch Reel",
          brief: "Need a sharp launch reel",
        },
        "agency-1",
        { agencyId: "agency-1", userId: "user-1", membershipId: "manager-1" } as any,
      ),
    ).rejects.toThrow("Writer required");
    expect(prisma.contentAsset.create).not.toHaveBeenCalled();
  });

  it("does not silently choose between multiple campaign writers", async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      clientId: "client-1",
      endDate: new Date("2026-08-20T12:00:00.000Z"),
      teamAssignments: [
        { membershipId: "writer-1", assignmentRole: "WRITER" },
        { membershipId: "writer-2", assignmentRole: "WRITER" },
      ],
      publishingSchedules: [],
    });
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
    });

    await expect(
      service.create(
        {
          clientId: "client-1",
          campaignId: "campaign-1",
          type: "REEL" as any,
          title: "Launch Reel",
          brief: "Need a sharp launch reel",
        },
        "agency-1",
        { agencyId: "agency-1", userId: "user-1", membershipId: "manager-1" } as any,
      ),
    ).rejects.toThrow("Multiple writers assigned");
    expect(prisma.contentAsset.create).not.toHaveBeenCalled();
  });

  it("allows an explicit content writer override when multiple campaign writers exist", async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      agencyId: "agency-1",
      clientId: "client-1",
      endDate: new Date("2026-08-20T12:00:00.000Z"),
      teamAssignments: [
        { membershipId: "writer-1", assignmentRole: "WRITER" },
        { membershipId: "writer-2", assignmentRole: "WRITER" },
        { membershipId: "manager-1", assignmentRole: "CAMPAIGN_MANAGER" },
      ],
      publishingSchedules: [],
    });
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
    });
    prisma.membership.findFirst.mockResolvedValue({ id: "member-ok" });
    prisma.contentAsset.create.mockResolvedValue({
      id: "asset-1",
      agencyId: "agency-1",
      clientId: "client-1",
      campaignId: "campaign-1",
      displayCode: "REEL-TEST",
      type: "REEL",
      title: "Launch Reel",
      brief: "Need a sharp launch reel",
      status: "ACTIVE",
    });
    prisma.workflowInstance.create.mockResolvedValue({
      id: "workflow-1",
      agencyId: "agency-1",
    });
    prisma.workflowTask.create.mockResolvedValue({
      id: "task-1",
      ownerMembershipId: "writer-2",
    });

    await service.create(
      {
        clientId: "client-1",
        campaignId: "campaign-1",
        displayCode: "REEL-TEST",
        type: "REEL" as any,
        title: "Launch Reel",
        brief: "Need a sharp launch reel",
        assigneeId: "writer-2",
      },
      "agency-1",
      { agencyId: "agency-1", userId: "user-1", membershipId: "manager-1" } as any,
    );

    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: "writer-2" }),
      }),
    );
  });

  it("loads campaign content rows for the current agency only", async () => {
    prisma.contentAsset.findMany.mockResolvedValue([
      {
        id: "asset-1",
        agencyId: "agency-1",
        campaignId: "campaign-1",
        clientId: "client-1",
        displayCode: "REEL-001",
        type: "REEL",
        title: "Independence Day Reel",
        brief: "Campaign planning row",
        status: "ACTIVE",
        workflowInstances: [],
      },
    ]);

    const assets = await service.findMany("agency-1", "campaign-1");

    expect(prisma.contentAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          agencyId: "agency-1",
          campaignId: "campaign-1",
          status: { not: "DELETED" },
        },
      }),
    );
    expect(assets).toHaveLength(1);
    expect(assets[0]).toEqual(
      expect.objectContaining({
        id: "asset-1",
        campaignId: "campaign-1",
        stage: "IDEA",
      }),
    );
  });

  it("updates the selected content asset and rejects cross-tenant edits", async () => {
    prisma.contentAsset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      agencyId: "agency-1",
    });
    prisma.contentAsset.update.mockResolvedValue({
      id: "asset-1",
      agencyId: "agency-1",
      campaignId: "campaign-1",
      title: "Founder Story",
      brief: "Updated brief",
      type: "REEL",
    });

    await service.update(
      "asset-1",
      { title: "Founder Story", brief: "Updated brief", type: "REEL" as any },
      "agency-1",
      "user-1",
    );

    expect(prisma.contentAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "asset-1" },
        data: expect.objectContaining({
          title: "Founder Story",
          brief: "Updated brief",
          type: "REEL",
        }),
      }),
    );

    prisma.contentAsset.findUnique.mockResolvedValueOnce({
      id: "asset-2",
      agencyId: "other-agency",
    });

    await expect(
      service.update("asset-2", { title: "Blocked" }, "agency-1", "user-1"),
    ).rejects.toThrow("Content asset not found");
  });
});
