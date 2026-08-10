import { Test, TestingModule } from "@nestjs/testing";
import { ClientContactService } from "./client-contact.service";
import { PrismaService } from "@packages/database/prisma.service";
import { CryptoService } from "@modules/auth/services/crypto.service";
import { UserLookupService } from "@modules/user/services/user-lookup.service";
import { EventBusService } from "@packages/events/event-bus.service";
import { NotFoundException } from "@nestjs/common";

describe("ClientContactService Unit Tests", () => {
  let service: ClientContactService;
  let prisma: any;
  let cryptoService: jest.Mocked<CryptoService>;
  let userLookup: jest.Mocked<UserLookupService>;
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(async () => {
    let mockPrisma: any;
    mockPrisma = {
      client: {
        findUnique: jest.fn(),
      },
      clientContact: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: any) => any) =>
        callback(mockPrisma),
      ),
    };

    const mockCrypto = {
      normalizeEmail: jest.fn((e: string) => e.trim().toLowerCase()),
      encrypt: jest.fn((text: string) => `encrypted:${text}`),
      decrypt: jest.fn((text: string) => text.replace("encrypted:", "")),
      hashEmailLookup: jest.fn((e: string) => `hash:${e}`),
      hashLookup: jest.fn((val: string) => `hash:${val}`),
    };

    const mockUserLookup = {
      findById: jest.fn(),
      findByAuthUserId: jest.fn(),
    };

    const mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishWithinTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientContactService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: UserLookupService, useValue: mockUserLookup },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<ClientContactService>(ClientContactService);
    prisma = module.get(PrismaService);
    cryptoService = module.get(CryptoService) as any;
    userLookup = module.get(UserLookupService) as any;
    eventBus = module.get(EventBusService) as any;
  });

  describe("createContact", () => {
    it("should create a contact with encrypted fields and publish event", async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: "client-1",
        agencyId: "agency-1",
      });
      prisma.clientContact.create.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
        userId: null,
        name: "Jane Doe",
        designation: "Marketing Lead",
        emailEncrypted: "encrypted:jane@acme.com",
        phoneEncrypted: "encrypted:+1234567890",
        whatsappEncrypted: null,
        role: "PRIMARY",
        isPrimary: true,
        preferredContactMethod: "EMAIL",
        status: "ACTIVE",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createContact(
        "client-1",
        {
          name: "Jane Doe",
          designation: "Marketing Lead",
          email: "Jane@Acme.com ",
          phone: "+1234567890",
          isPrimary: true,
          role: "PRIMARY",
        },
        "agency-1",
        "actor-1",
      );

      expect(prisma.clientContact.updateMany).toHaveBeenCalledWith({
        where: {
          agencyId: "agency-1",
          clientId: "client-1",
          isPrimary: true,
          deletedAt: null,
        },
        data: { isPrimary: false },
      });
      expect(cryptoService.encrypt).toHaveBeenCalledWith("jane@acme.com");
      expect(result.email).toBe("jane@acme.com");
      expect(result.phone).toBe("+1234567890");
      expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
        prisma,
        "ClientContactCreated",
        expect.objectContaining({
          agencyId: "agency-1",
          aggregateId: "contact-1",
          aggregateType: "ClientContact",
          payload: expect.objectContaining({ contactId: "contact-1" }),
        }),
      );
    });

    it("should throw NotFoundException if client does not exist in target agency", async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.createContact(
          "client-999",
          { name: "John" },
          "agency-1",
          "actor-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateContact", () => {
    it("should update contact details and re-encrypt updated contact methods", async () => {
      prisma.clientContact.findUnique.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
      });
      prisma.clientContact.update.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
        name: "Jane Smith",
        designation: "VP Marketing",
        emailEncrypted: "encrypted:janesmith@acme.com",
        phoneEncrypted: "encrypted:+1234567890",
        whatsappEncrypted: null,
        role: "EXECUTIVE",
        isPrimary: false,
        status: "ACTIVE",
        version: 2,
      });

      const result = await service.updateContact(
        "client-1",
        "contact-1",
        {
          name: "Jane Smith",
          designation: "VP Marketing",
          email: "janesmith@acme.com",
          role: "EXECUTIVE",
        },
        "agency-1",
        "actor-1",
      );

      expect(result.name).toBe("Jane Smith");
      expect(result.email).toBe("janesmith@acme.com");
      expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
        prisma,
        "ClientContactUpdated",
        expect.objectContaining({
          agencyId: "agency-1",
          aggregateId: "contact-1",
          aggregateType: "ClientContact",
          payload: expect.objectContaining({ contactId: "contact-1" }),
        }),
      );
    });

    it("should reset other primary contacts when this contact becomes primary", async () => {
      prisma.clientContact.findUnique.mockResolvedValue({
        id: "contact-2",
        agencyId: "agency-1",
        clientId: "client-1",
        deletedAt: null,
      });
      prisma.clientContact.update.mockResolvedValue({
        id: "contact-2",
        agencyId: "agency-1",
        clientId: "client-1",
        name: "New Primary",
        isPrimary: true,
        status: "ACTIVE",
        version: 2,
      });

      await service.updateContact(
        "client-1",
        "contact-2",
        { isPrimary: true },
        "agency-1",
        "actor-1",
      );

      expect(prisma.clientContact.updateMany).toHaveBeenCalledWith({
        where: {
          agencyId: "agency-1",
          clientId: "client-1",
          isPrimary: true,
          id: { not: "contact-2" },
          deletedAt: null,
        },
        data: { isPrimary: false },
      });
    });
  });

  describe("archiveContact", () => {
    it("should set status to INACTIVE and soft delete contact", async () => {
      prisma.clientContact.findUnique.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
      });
      prisma.clientContact.update.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
        name: "Jane Smith",
        status: "INACTIVE",
        deletedAt: new Date(),
        version: 2,
      });

      const result = await service.archiveContact(
        "client-1",
        "contact-1",
        "agency-1",
        "actor-1",
      );

      expect(result.status).toBe("INACTIVE");
      expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
        prisma,
        "ClientContactArchived",
        expect.objectContaining({
          agencyId: "agency-1",
          aggregateId: "contact-1",
          aggregateType: "ClientContact",
          payload: expect.objectContaining({ contactId: "contact-1" }),
        }),
      );
    });
  });

  describe("linkUser", () => {
    it("should link a universal user profile to the client contact", async () => {
      prisma.clientContact.findUnique.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
      });
      userLookup.findById.mockResolvedValue({
        id: "user-100",
        name: "Jane Portal User",
      } as any);
      prisma.clientContact.update.mockResolvedValue({
        id: "contact-1",
        agencyId: "agency-1",
        clientId: "client-1",
        userId: "user-100",
        name: "Jane Smith",
        status: "ACTIVE",
        version: 2,
      });

      const result = await service.linkUser(
        "client-1",
        "contact-1",
        "user-100",
        "agency-1",
        "actor-1",
      );

      expect(result.userId).toBe("user-100");
      expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
        prisma,
        "ClientContactLinkedToUser",
        expect.objectContaining({
          agencyId: "agency-1",
          aggregateId: "contact-1",
          aggregateType: "ClientContact",
          payload: expect.objectContaining({
            contactId: "contact-1",
            userId: "user-100",
          }),
        }),
      );
    });
  });

  describe("findContactsByClient", () => {
    it("should list all contacts for a client and decrypt encrypted fields", async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: "client-1",
        agencyId: "agency-1",
      });
      prisma.clientContact.findMany.mockResolvedValue([
        {
          id: "contact-1",
          agencyId: "agency-1",
          clientId: "client-1",
          name: "Contact 1",
          emailEncrypted: "encrypted:c1@acme.com",
          phoneEncrypted: null,
          whatsappEncrypted: null,
          isPrimary: true,
          status: "ACTIVE",
        },
      ]);

      const results = await service.findContactsByClient(
        "client-1",
        "agency-1",
      );

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe("c1@acme.com");
    });
  });
});
