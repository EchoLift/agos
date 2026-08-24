import { ClientService } from "./client.service";
import { DomainEvents } from "@packages/events/domain-event";

describe("ClientService", () => {
  let service: ClientService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      client: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      membership: {
        findUnique: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      membershipRole: {
        createMany: jest.fn(),
      },
      clientUserAccess: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue({}),
    };

    service = new ClientService(prisma, eventBus);
  });

  it("creates a client in the current agency and publishes a domain event", async () => {
    const dto = {
      agencyId: "agency-1",
      name: "Northwind Studios",
      industry: "E-commerce",
      primaryContactName: "Avery North",
      primaryContactUserId: "user-primary",
      primaryContactEmail: "avery@northwind.example",
      invitePrimaryContact: false,
      brandVoice: "Confident",
      audience: "Founders",
      competitors: "Acme, Globex",
    };

    prisma.client.create.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
      name: dto.name,
      industry: dto.industry,
      status: "ACTIVE",
    });
    prisma.membership.findUnique.mockResolvedValue({
      id: "mem-primary",
      status: "ACTIVE",
      deletedAt: null,
      role: { systemRole: { key: "MEMBER" } },
      roles: [],
    });
    prisma.role.findFirst.mockResolvedValue({ id: "role-client" });

    const client = await service.create(dto, "agency-1", "user-1");

    expect(prisma.client.create).toHaveBeenCalledWith({
      data: {
        agencyId: "agency-1",
        name: dto.name,
        industry: dto.industry,
        primaryContactUserId: "user-primary",
        primaryContactName: dto.primaryContactName,
        primaryContactEmail: dto.primaryContactEmail,
        brandVoice: dto.brandVoice,
        audience: dto.audience,
        competitors: dto.competitors,
        status: "ACTIVE",
      },
    });
    expect(prisma.membershipRole.createMany).toHaveBeenCalledWith({
      data: [{ membershipId: "mem-primary", roleId: "role-client" }],
      skipDuplicates: true,
    });
    expect(prisma.clientUserAccess.upsert).toHaveBeenCalledWith({
      where: {
        agencyId_clientId_userId: {
          agencyId: "agency-1",
          clientId: "client-1",
          userId: "user-primary",
        },
      },
      update: {},
      create: {
        agencyId: "agency-1",
        clientId: "client-1",
        userId: "user-primary",
      },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ClientCreated,
      expect.objectContaining({
        agencyId: "agency-1",
        actorId: "user-1",
        payload: expect.objectContaining({ clientId: "client-1" }),
      }),
    );
    expect(client).toEqual(expect.objectContaining({ id: "client-1" }));
  });

  it("archives a client and publishes an archive event", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
    });
    prisma.client.update.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
      status: "ARCHIVED",
    });

    const client = await service.archive("client-1", "agency-1", "user-1");

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { status: "ARCHIVED" },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ClientArchived,
      expect.objectContaining({
        agencyId: "agency-1",
        actorId: "user-1",
        payload: expect.objectContaining({ clientId: "client-1" }),
      }),
    );
    expect(client).toEqual(expect.objectContaining({ status: "ARCHIVED" }));
  });

  it("changes primary contact and grants client access atomically", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
      primaryContactUserId: "user-old",
    });
    prisma.membership.findUnique.mockResolvedValue({
      id: "mem-new-primary",
      status: "ACTIVE",
      deletedAt: null,
      role: { systemRole: { key: "MEMBER" } },
      roles: [],
    });
    prisma.role.findFirst.mockResolvedValue({ id: "role-client" });
    prisma.client.update.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
      primaryContactUserId: "user-new",
    });

    const result = await service.update(
      "client-1",
      { primaryContactUserId: "user-new" },
      "agency-1",
      "actor-1",
    );

    expect(prisma.membershipRole.createMany).toHaveBeenCalledWith({
      data: [{ membershipId: "mem-new-primary", roleId: "role-client" }],
      skipDuplicates: true,
    });
    expect(prisma.clientUserAccess.upsert).toHaveBeenCalledWith({
      where: {
        agencyId_clientId_userId: {
          agencyId: "agency-1",
          clientId: "client-1",
          userId: "user-new",
        },
      },
      update: {},
      create: {
        agencyId: "agency-1",
        clientId: "client-1",
        userId: "user-new",
      },
    });
    expect(prisma.clientUserAccess.deleteMany).not.toHaveBeenCalled();
    expect(result.primaryContactUserId).toBe("user-new");
  });

  it("does not allow clearing a primary contact without a replacement", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "client-1",
      agencyId: "agency-1",
      primaryContactUserId: "user-old",
    });

    await expect(
      service.update(
        "client-1",
        { primaryContactUserId: null },
        "agency-1",
        "actor-1",
      ),
    ).rejects.toThrow("Primary contact user is required.");

    expect(prisma.client.update).not.toHaveBeenCalled();
    expect(prisma.clientUserAccess.upsert).not.toHaveBeenCalled();
  });
});
