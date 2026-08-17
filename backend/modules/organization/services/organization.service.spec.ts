import { Test, TestingModule } from "@nestjs/testing";
import { OrganizationService } from "./organization.service";
import { OrganizationRepository } from "../repositories/organization.repository";
import { UserLookupService } from "../../user/services/user-lookup.service";
import { CryptoService } from "../../auth/services/crypto.service";
import { RequestContextService } from "@packages/request-context/request-context.service";
import { PrismaService } from "@packages/database/prisma.service";
import { EventBusService } from "@packages/events/event-bus.service";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  User,
  Agency,
  Membership,
  Role,
  Invitation,
  Prisma,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";

describe("OrganizationService Unit Tests", () => {
  let service: OrganizationService;
  let repository: jest.Mocked<OrganizationRepository>;
  let userLookup: jest.Mocked<UserLookupService>;
  let cryptoService: jest.Mocked<CryptoService>;
  let configService: jest.Mocked<ConfigService>;
  let prisma: any;
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(async () => {
    const mockRepo = {
      createAgencyWithOwner: jest.fn(),
      findAgencyBySlug: jest.fn(),
      findMembershipsByUserId: jest.fn(),
      findMembership: jest.fn(),
      findActiveSessionAgency: jest.fn(),
      createInvitation: jest.fn(),
      findInvitationByToken: jest.fn(),
      acceptInvitation: jest.fn(),
      findRoleById: jest.fn(),
      findRoles: jest.fn(),
      findAgencyById: jest.fn(),
      activateSessionAgency: jest.fn(),
      findMembersByAgencyId: jest.fn(),
      findMembershipById: jest.fn(),
      findAgencyRolesByIds: jest.fn(),
      updateMembershipRole: jest.fn(),
      removeMembership: jest.fn(),
      countActiveOwners: jest.fn(),
    };

    const mockUserLookup = {
      findByAuthUserId: jest.fn(),
      findById: jest.fn(),
    };

    const mockCrypto = {
      hashLookup: jest.fn().mockReturnValue("hashed-email"),
      normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
      hashEmailLookup: jest.fn().mockReturnValue("hashed-email"),
      encrypt: jest.fn().mockReturnValue("encrypted-email"),
      decrypt: jest.fn((value: string) => value),
    };

    const mockRequestContext = {
      get: jest
        .fn()
        .mockReturnValue({ correlationId: "corr-123", requestId: "req-123" }),
    };
    const mockPrisma: any = {
      systemRole: { upsert: jest.fn() },
      permission: { upsert: jest.fn() },
      systemRolePermission: { upsert: jest.fn() },
      invitation: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      notificationDelivery: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      client: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: any) => unknown) => callback(mockPrisma),
    );
    const mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: OrganizationRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserLookupService, useValue: mockUserLookup },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: EventBusService, useValue: mockEventBus },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NODE_ENV") return "test";
              if (key === "DEV_ROLE_TESTING_OVERRIDE_ENABLED") return "false";
              if (key === "DEV_ROLE_TESTING_AUTH_USER_IDS") return "";
              if (key === "DEV_ROLE_TESTING_USER_IDS") return "";
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    repository = module.get(OrganizationRepository) as any;
    userLookup = module.get(UserLookupService) as any;
    cryptoService = module.get(CryptoService) as any;
    configService = module.get(ConfigService) as any;
    prisma = module.get(PrismaService);
    eventBus = module.get(EventBusService) as jest.Mocked<EventBusService>;
  });

  describe("createAgency", () => {
    it("should create an agency and return owner membership", async () => {
      const mockUser = { id: "user-1", authUserId: "auth-user-1" } as User;
      const mockAgency = {
        id: "agency-1",
        name: "sunrise-media",
        displayName: "Sunrise Media",
        slug: "sunrise-media",
      } as Agency;
      const mockMembership = {
        id: "mem-1",
        agencyId: "agency-1",
        userId: "user-1",
      } as Membership;

      userLookup.findByAuthUserId.mockResolvedValue(mockUser);
      repository.findAgencyBySlug.mockResolvedValue(null);
      repository.createAgencyWithOwner.mockResolvedValue({
        agency: mockAgency,
        membership: mockMembership,
      });

      const result = await service.createAgency(
        { displayName: "Sunrise Media", slug: "sunrise-media" },
        "auth-user-1",
        "session-1",
      );

      expect(result.agency.displayName).toBe("Sunrise Media");
      expect(result.membership.role).toBe("OWNER");
      expect(repository.createAgencyWithOwner).toHaveBeenCalledWith(
        "Sunrise Media",
        "sunrise-media",
        "user-1",
        "auth-user-1",
        "session-1",
        "corr-123",
      );
    });

    it("should throw NotFoundException if user profile does not exist", async () => {
      userLookup.findByAuthUserId.mockResolvedValue(null);

      await expect(
        service.createAgency(
          { displayName: "Sunrise Media", slug: "sunrise-media" },
          "auth-user-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getMyMemberships", () => {
    it("should return active agency and list of memberships", async () => {
      const mockUser = { id: "user-1" } as User;
      userLookup.findByAuthUserId.mockResolvedValue(mockUser);

      repository.findMembershipsByUserId.mockResolvedValue([
        {
          id: "mem-1",
          agency: {
            id: "agency-1",
            name: "sunrise-media",
            displayName: "Sunrise Media",
            slug: "sunrise-media",
          },
          role: {
            id: "role-owner",
            displayName: "Owner",
            systemRole: { key: "OWNER" },
          },
          roles: [
            {
              role: {
                id: "role-owner",
                displayName: "Owner",
                systemRole: { key: "OWNER" },
              },
            },
          ],
        },
      ]);
      repository.findActiveSessionAgency.mockResolvedValue("agency-1");

      const result = await service.getMyMemberships("auth-user-1", "session-1");

      expect(result.activeAgencyId).toBe("agency-1");
      expect(result.currentAgency?.displayName).toBe("Sunrise Media");
      expect(result.agencies).toHaveLength(1);
    });
  });

  describe("inviteMember", () => {
    it("should create an invitation for valid inviter and role", async () => {
      const mockInviter = { id: "user-inviter" } as User;
      const mockInviterMem = {
        id: "mem-inviter",
        agencyId: "agency-1",
      } as Membership;
      const mockRole = {
        id: "role-manager",
        displayName: "MANAGER",
        systemRole: { key: "MANAGER" },
      } as unknown as Role;
      const mockInvitation = {
        id: "inv-1",
        agencyId: "agency-1",
        status: "PENDING",
        expiresAt: new Date(),
        token: "rand-token",
      } as unknown as Invitation;

      userLookup.findByAuthUserId.mockResolvedValue(mockInviter);
      repository.findMembership.mockResolvedValue(mockInviterMem);
      repository.findRoleById.mockResolvedValue(mockRole);
      repository.findRoles.mockResolvedValue([mockRole]);
      repository.createInvitation.mockResolvedValue(mockInvitation);

      const result = await service.inviteMember(
        "agency-1",
        { email: "editor@example.com", roleId: "role-manager" },
        "auth-inviter",
      );

      expect(result.invitationId).toBe("inv-1");
      expect(result.roleName).toBe("MANAGER");
      expect(cryptoService.normalizeEmail).toHaveBeenCalledWith(
        "editor@example.com",
      );
      expect(cryptoService.hashEmailLookup).toHaveBeenCalledWith(
        "editor@example.com",
      );
    });

    it("requires a business client when inviting the CLIENT role", async () => {
      const inviter = { id: "user-inviter" } as User;
      const inviterMembership = { id: "mem-inviter", agencyId: "agency-1" };
      const clientRole = {
        id: "role-client",
        displayName: "Client",
        systemRole: { key: "CLIENT" },
      } as any;

      userLookup.findByAuthUserId.mockResolvedValue(inviter);
      repository.findMembership.mockResolvedValue(inviterMembership as any);
      repository.findRoleById.mockResolvedValue(clientRole);
      repository.findRoles.mockResolvedValue([clientRole]);

      await expect(
        service.inviteMember(
          "agency-1",
          { email: "client@example.com", roleId: "role-client" },
          "auth-inviter",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createInvitation).not.toHaveBeenCalled();
    });

    it("stores the selected business client on CLIENT invitations", async () => {
      const inviter = { id: "user-inviter" } as User;
      const inviterMembership = { id: "mem-inviter", agencyId: "agency-1" };
      const clientRole = {
        id: "role-client",
        displayName: "Client",
        systemRole: { key: "CLIENT" },
      } as any;

      userLookup.findByAuthUserId.mockResolvedValue(inviter);
      repository.findMembership.mockResolvedValue(inviterMembership as any);
      repository.findRoleById.mockResolvedValue(clientRole);
      repository.findRoles.mockResolvedValue([clientRole]);
      prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
      repository.createInvitation.mockResolvedValue({
        id: "inv-1",
        status: "PENDING",
        expiresAt: new Date(),
        token: "token-1",
        roles: [{ role: clientRole }],
      } as any);

      await service.inviteMember(
        "agency-1",
        {
          email: "client@example.com",
          roleId: "role-client",
          clientId: "client-1",
        },
        "auth-inviter",
      );

      expect(repository.createInvitation).toHaveBeenCalledWith(
        "agency-1",
        "hashed-email",
        "role-client",
        "mem-inviter",
        expect.any(String),
        expect.any(Date),
        ["role-client"],
        null,
        "client-1",
        "corr-123",
        "encrypted-email",
      );
    });

    it("rejects CLIENT invitations for clients outside the agency", async () => {
      const inviter = { id: "user-inviter" } as User;
      const inviterMembership = { id: "mem-inviter", agencyId: "agency-1" };
      const clientRole = {
        id: "role-client",
        displayName: "Client",
        systemRole: { key: "CLIENT" },
      } as any;

      userLookup.findByAuthUserId.mockResolvedValue(inviter);
      repository.findMembership.mockResolvedValue(inviterMembership as any);
      repository.findRoleById.mockResolvedValue(clientRole);
      repository.findRoles.mockResolvedValue([clientRole]);
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.inviteMember(
          "agency-1",
          {
            email: "client@example.com",
            roleId: "role-client",
            clientId: "client-other",
          },
          "auth-inviter",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createInvitation).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException if inviter is not a member of agency", async () => {
      userLookup.findByAuthUserId.mockResolvedValue({ id: "user-1" } as User);
      repository.findMembership.mockResolvedValue(null);

      await expect(
        service.inviteMember(
          "agency-1",
          { email: "e@test.com", roleId: "r-1" },
          "auth-1",
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    // Security regression: the @RequirePermissions("TEAM_INVITE") decorator on the
    // controller endpoint ensures the PermissionsGuard blocks WRITER-role callers
    // before they reach inviteMember(). A WRITER has no seeded permissions, so
    // user.permissions will be empty and the guard throws ForbiddenException with
    // PERMISSION_DENIED code. This is validated in permissions.guard.spec.ts.
  });

  describe("resendInvitation", () => {
    const ownerActor = {
      authUserId: "auth-owner",
      userId: "user-owner",
      agencyId: "agency-1",
      membershipId: "mem-owner",
      role: "OWNER",
      roles: ["OWNER"],
    } as any;

    const invitationFixture = (overrides: Partial<any> = {}) => ({
      id: "inv-1",
      agencyId: "agency-1",
      emailEncrypted: "editor@example.com",
      emailHash: "hash-editor",
      mobileNumber: null,
      roleId: "role-writer",
      status: "PENDING",
      token: "existing-token",
      expiresAt: new Date(Date.now() + 86400000),
      lastEmailResentAt: null,
      createdAt: new Date("2026-08-14T15:33:00.000Z"),
      agency: {
        id: "agency-1",
        name: "EchoLift",
        displayName: "EchoLift",
        slug: "echolift",
      },
      role: {
        id: "role-writer",
        displayName: "Writer",
        systemRole: { key: "WRITER" },
      },
      roles: [
        {
          roleId: "role-writer",
          role: {
            id: "role-writer",
            displayName: "Writer",
            systemRole: { key: "WRITER" },
          },
        },
      ],
      invitedBy: null,
      ...overrides,
    });

    const existingDelivery = (overrides: Partial<any> = {}) => ({
      id: "delivery-1",
      agencyId: "agency-1",
      notificationId: "notification-1",
      invitationId: "inv-1",
      channel: "EMAIL",
      status: "SENT",
      retryCount: 0,
      ...overrides,
    });

    it("resends an existing pending invitation by requeueing the existing delivery", async () => {
      const invitation = invitationFixture();
      const delivery = existingDelivery();
      prisma.invitation.findFirst.mockResolvedValue(invitation);
      prisma.invitation.update.mockResolvedValue({
        ...invitation,
        lastEmailResentAt: expect.any(Date),
      });
      prisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
      prisma.notificationDelivery.update.mockResolvedValue({
        ...delivery,
        status: "QUEUED",
      });

      const result = await service.resendInvitation(
        "agency-1",
        "inv-1",
        ownerActor,
      );

      expect(result.id).toBe("inv-1");
      expect(result.inviteUrl).toContain("existing-token");
      expect(repository.createInvitation).not.toHaveBeenCalled();
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { lastEmailResentAt: expect.any(Date) },
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: "delivery-1" },
        data: expect.objectContaining({
          status: "QUEUED",
          retryCount: 0,
          lastError: null,
          nextRetryAt: null,
          sentAt: null,
        }),
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        "NotificationQueued",
        expect.objectContaining({
          aggregateId: "delivery-1",
          payload: expect.objectContaining({
            deliveryId: "delivery-1",
            notificationId: "notification-1",
            invitationId: "inv-1",
          }),
        }),
      );
    });

    it("resend after 48 hours succeeds", async () => {
      const invitation = invitationFixture({
        lastEmailResentAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      });
      const delivery = existingDelivery();
      prisma.invitation.findFirst.mockResolvedValue(invitation);
      prisma.invitation.update.mockResolvedValue({
        ...invitation,
        lastEmailResentAt: new Date(),
      });
      prisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
      prisma.notificationDelivery.update.mockResolvedValue({
        ...delivery,
        status: "QUEUED",
      });

      await expect(
        service.resendInvitation("agency-1", "inv-1", ownerActor),
      ).resolves.toEqual(
        expect.objectContaining({
          id: "inv-1",
          canResendEmail: false,
          lastEmailResentAt: expect.any(String),
        }),
      );

      expect(prisma.notificationDelivery.update).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it("resend before 48 hours fails with 429 and availability timestamp", async () => {
      const lastEmailResentAt = new Date(Date.now() - 17 * 60 * 60 * 1000);
      prisma.invitation.findFirst.mockResolvedValue(
        invitationFixture({ lastEmailResentAt }),
      );

      let caught: unknown;
      try {
        await service.resendInvitation("agency-1", "inv-1", ownerActor);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getStatus()).toBe(429);
      expect((caught as HttpException).getResponse()).toEqual(
        expect.objectContaining({
          resendAvailableAt: new Date(
            lastEmailResentAt.getTime() + 48 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      );
      expect(prisma.invitation.update).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("creates the initial notification delivery only when none exists yet", async () => {
      const invitation = invitationFixture();
      prisma.invitation.findFirst.mockResolvedValue(invitation);
      prisma.invitation.update.mockResolvedValue({
        ...invitation,
        lastEmailResentAt: new Date(),
      });
      prisma.notificationDelivery.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: "notification-new" });
      prisma.notificationDelivery.create.mockResolvedValue({
        ...existingDelivery(),
        id: "delivery-new",
        notificationId: "notification-new",
        status: "QUEUED",
      });

      await service.resendInvitation("agency-1", "inv-1", ownerActor);

      expect(repository.createInvitation).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: "inv-1",
          channel: "EMAIL",
          status: "QUEUED",
        }),
      });
    });

    it("keeps repeated resend safe by updating the same delivery record", async () => {
      const invitation = invitationFixture();
      const delivery = existingDelivery();
      prisma.invitation.findFirst.mockResolvedValue(invitation);
      prisma.invitation.update.mockResolvedValue({
        ...invitation,
        lastEmailResentAt: new Date(),
      });
      prisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
      prisma.notificationDelivery.update.mockResolvedValue({
        ...delivery,
        status: "QUEUED",
      });

      await service.resendInvitation("agency-1", "inv-1", ownerActor);
      await service.resendInvitation("agency-1", "inv-1", ownerActor);

      expect(prisma.notificationDelivery.update).toHaveBeenCalledTimes(2);
      expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(repository.createInvitation).not.toHaveBeenCalled();
    });

    it("rejects accepted invitations", async () => {
      prisma.invitation.findFirst.mockResolvedValue(
        invitationFixture({ status: "ACCEPTED" }),
      );

      await expect(
        service.resendInvitation("agency-1", "inv-1", ownerActor),
      ).rejects.toThrow("Invitation already accepted.");

      expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    });

    it("rejects revoked invitations", async () => {
      prisma.invitation.findFirst.mockResolvedValue(
        invitationFixture({ status: "CANCELLED" }),
      );

      await expect(
        service.resendInvitation("agency-1", "inv-1", ownerActor),
      ).rejects.toThrow("Invitation revoked.");

      expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    });

    it("rejects expired invitations", async () => {
      prisma.invitation.findFirst.mockResolvedValue(
        invitationFixture({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.resendInvitation("agency-1", "inv-1", ownerActor),
      ).rejects.toThrow("Invitation expired.");

      expect(repository.createInvitation).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    });

    it("does not resend an invitation from another agency", async () => {
      prisma.invitation.findFirst.mockResolvedValue(null);

      await expect(
        service.resendInvitation("agency-1", "other-agency-inv", ownerActor),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.invitation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "other-agency-inv", agencyId: "agency-1" },
        }),
      );
      expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    });

    it("does not expose raw Prisma unique constraint errors to the frontend", async () => {
      const invitation = invitationFixture();
      const delivery = existingDelivery();
      prisma.invitation.findFirst.mockResolvedValue(invitation);
      prisma.invitation.update.mockResolvedValue({
        ...invitation,
        lastEmailResentAt: new Date(),
      });
      prisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
      prisma.notificationDelivery.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed on the fields: (`invitationId`,`channel`)",
          {
            code: "P2002",
            clientVersion: "test",
            meta: { target: ["invitationId", "channel"] },
          },
        ),
      );

      let caught: unknown;
      try {
        await service.resendInvitation("agency-1", "inv-1", ownerActor);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(InternalServerErrorException);
      expect((caught as Error).message).toBe(
        "Unable to resend invitation right now.",
      );
      expect((caught as Error).message).not.toContain(
        "Unique constraint failed",
      );
    });
  });

  describe("acceptInvitation", () => {
    it("should accept invitation and return new membership", async () => {
      const mockUser = { id: "user-2" } as User;
      const mockInvitation = {
        id: "inv-1",
        agencyId: "agency-1",
        clientId: "client-1",
        roleId: "role-member",
        status: "PENDING",
        agency: {
          id: "agency-1",
          name: "socia-expert",
          displayName: "Socia Expert",
          slug: "socia-expert",
        },
      } as unknown as Invitation;
      const mockMembership = {
        id: "mem-new",
        agencyId: "agency-1",
        clientId: "client-1",
        status: "ACTIVE",
      } as Membership;

      userLookup.findByAuthUserId.mockResolvedValue(mockUser);
      repository.findInvitationByToken.mockResolvedValue(mockInvitation);
      repository.findMembership.mockResolvedValue(null);
      repository.acceptInvitation.mockResolvedValue(mockMembership);

      const result = await service.acceptInvitation("token-123", "auth-2");

      expect(result.membershipId).toBe("mem-new");
      expect(result.status).toBe("ACTIVE");
      expect(result.clientId).toBe("client-1");
      expect(result.agency.slug).toBe("socia-expert");
      expect(repository.acceptInvitation).toHaveBeenCalledWith(
        "inv-1",
        "agency-1",
        "user-2",
        "role-member",
        ["role-member"],
        "client-1",
        "corr-123",
      );
    });

    it("should resolve an already accepted invitation for the active member", async () => {
      userLookup.findByAuthUserId.mockResolvedValue({ id: "user-2" } as User);
      repository.findInvitationByToken.mockResolvedValue({
        id: "inv-1",
        agencyId: "agency-1",
        status: "ACCEPTED",
        agency: {
          id: "agency-1",
          name: "socia-expert",
          displayName: "Socia Expert",
          slug: "socia-expert",
        },
      } as unknown as Invitation);
      repository.findMembership.mockResolvedValue({
        id: "mem-existing",
        agencyId: "agency-1",
        status: "ACTIVE",
        deletedAt: null,
      } as Membership);

      const result = await service.acceptInvitation("token-123", "auth-2");

      expect(result.membershipId).toBe("mem-existing");
      expect(result.agency.slug).toBe("socia-expert");
      expect(repository.acceptInvitation).not.toHaveBeenCalled();
    });

    it("should reject an accepted invitation when the user is not an active member", async () => {
      userLookup.findByAuthUserId.mockResolvedValue({ id: "user-2" } as User);
      repository.findInvitationByToken.mockResolvedValue({
        id: "inv-1",
        agencyId: "agency-1",
        status: "ACCEPTED",
        agency: {
          id: "agency-1",
          name: "socia-expert",
          displayName: "Socia Expert",
          slug: "socia-expert",
        },
      } as unknown as Invitation);
      repository.findMembership.mockResolvedValue(null);

      await expect(
        service.acceptInvitation("token-123", "auth-2"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("activateAgency", () => {
    it("validates active membership server-side and updates the session agency", async () => {
      const membership = {
        id: "mem-1",
        status: "ACTIVE",
        role: {
          id: "role-owner",
          displayName: "Owner",
          systemRole: { key: "OWNER" },
        },
        roles: [
          {
            role: {
              id: "role-owner",
              displayName: "Owner",
              systemRole: { key: "OWNER" },
            },
          },
        ],
      };
      repository.findMembership.mockResolvedValue(membership as any);
      repository.findAgencyById.mockResolvedValue({
        id: "agency-1",
        name: "socialexpert",
        displayName: "SocialExpert",
        slug: "socialexpert",
      } as Agency);
      repository.activateSessionAgency.mockResolvedValue({
        id: "session-1",
      } as any);

      const result = await service.activateAgency("agency-1", {
        authUserId: "auth-1",
        userId: "user-1",
        sessionId: "session-1",
      } as any);

      expect(repository.findMembership).toHaveBeenCalledWith(
        "agency-1",
        "user-1",
      );
      expect(repository.activateSessionAgency).toHaveBeenCalledWith(
        "session-1",
        "agency-1",
        "mem-1",
        "corr-123",
      );
      expect(result.agency.roles).toEqual([
        { id: "role-owner", key: "OWNER", name: "Owner" },
      ]);
    });

    it("rejects switching to an agency without active membership", async () => {
      repository.findMembership.mockResolvedValue(null);

      await expect(
        service.activateAgency("agency-1", {
          userId: "user-1",
          sessionId: "session-1",
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("updateMemberRole", () => {
    const editorRole = {
      id: "role-editor",
      displayName: "Editor",
      systemRole: { key: "EDITOR" },
    };
    const ownerRole = {
      id: "role-owner",
      displayName: "Owner",
      systemRole: { key: "OWNER" },
    };
    const clientRole = {
      id: "role-client",
      displayName: "Client",
      systemRole: { key: "CLIENT" },
    };
    const ownerActor = {
      authUserId: "auth-owner",
      userId: "user-owner",
      agencyId: "agency-1",
      membershipId: "mem-owner",
      role: "OWNER",
      roles: ["OWNER"],
    } as any;

    beforeEach(() => {
      configService.get.mockImplementation((key: string) => {
        if (key === "NODE_ENV") return "development";
        if (key === "DEV_ROLE_TESTING_OVERRIDE_ENABLED") return "true";
        if (key === "DEV_ROLE_TESTING_USER_IDS") return "user-allowed";
        if (key === "DEV_ROLE_TESTING_AUTH_USER_IDS") return "";
        return null;
      });
    });

    it("allows an explicitly configured user to update only their own roles for local testing", async () => {
      const membership = {
        id: "mem-self",
        agencyId: "agency-1",
        userId: "user-allowed",
        status: "ACTIVE",
        role: editorRole,
        roles: [{ role: editorRole }],
        user: {
          name: "EchoLift",
          avatarUrl: null,
          authUser: { emailEncrypted: "encrypted@example.com" },
        },
      };
      const updatedMembership = {
        ...membership,
        roleId: ownerRole.id,
        role: ownerRole,
        roles: [{ role: ownerRole }],
        version: 3,
        joinedAt: new Date("2026-08-08T00:00:00.000Z"),
      };

      repository.findMembershipById.mockResolvedValue(membership as any);
      repository.findAgencyRolesByIds.mockResolvedValue([ownerRole] as any);
      repository.updateMembershipRole.mockResolvedValue(
        updatedMembership as any,
      );

      const result = await service.updateMemberRole(
        "agency-1",
        "mem-self",
        { roleId: "role-owner", roleIds: ["role-owner"], version: 2 },
        {
          authUserId: "auth-allowed",
          userId: "user-allowed",
          agencyId: "agency-1",
          membershipId: "mem-self",
          role: "EDITOR",
          roles: ["EDITOR"],
        } as any,
      );

      expect(repository.updateMembershipRole).toHaveBeenCalledWith(
        "agency-1",
        "mem-self",
        "role-owner",
        ["role-owner"],
        2,
        null,
        "auth-allowed",
        "corr-123",
      );
      expect(result.roles).toEqual([
        { id: "role-owner", key: "OWNER", name: "Owner" },
      ]);
    });

    it("adds CLIENT to an existing member when a valid business client is selected", async () => {
      const membership = {
        id: "mem-editor",
        agencyId: "agency-1",
        userId: "user-editor",
        status: "ACTIVE",
        role: editorRole,
        roles: [{ role: editorRole }],
        user: { name: "Editor", avatarUrl: null, authUser: null },
        version: 2,
      };
      const updatedMembership = {
        ...membership,
        roleId: editorRole.id,
        role: editorRole,
        roles: [{ role: editorRole }, { role: clientRole }],
        clientId: "client-1",
        client: { id: "client-1", name: "Taaza Kitchen", displayName: null },
        joinedAt: new Date("2026-08-08T00:00:00.000Z"),
        version: 3,
      };

      repository.findMembershipById.mockResolvedValue(membership as any);
      repository.findAgencyRolesByIds.mockResolvedValue([
        editorRole,
        clientRole,
      ] as any);
      prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
      repository.updateMembershipRole.mockResolvedValue(
        updatedMembership as any,
      );

      const result = await service.updateMemberRole(
        "agency-1",
        "mem-editor",
        {
          roleId: "role-editor",
          roleIds: ["role-editor", "role-client"],
          clientId: "client-1",
          version: 2,
        },
        ownerActor,
      );

      expect(repository.updateMembershipRole).toHaveBeenCalledWith(
        "agency-1",
        "mem-editor",
        "role-editor",
        ["role-editor", "role-client"],
        2,
        "client-1",
        "auth-owner",
        "corr-123",
      );
      expect(result.clientId).toBe("client-1");
      expect(repository.createInvitation).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
    });

    it("rejects adding CLIENT without a business client", async () => {
      repository.findMembershipById.mockResolvedValue({
        id: "mem-editor",
        agencyId: "agency-1",
        userId: "user-editor",
        status: "ACTIVE",
        role: editorRole,
        roles: [{ role: editorRole }],
      } as any);
      repository.findAgencyRolesByIds.mockResolvedValue([
        editorRole,
        clientRole,
      ] as any);

      await expect(
        service.updateMemberRole(
          "agency-1",
          "mem-editor",
          {
            roleId: "role-editor",
            roleIds: ["role-editor", "role-client"],
            version: 2,
          },
          ownerActor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateMembershipRole).not.toHaveBeenCalled();
    });

    it.each(["WRITER", "DOP"])(
      "rejects direct role edits from %s memberships",
      async (roleKey) => {
        repository.findMembershipById.mockResolvedValue({
          id: "mem-editor",
          agencyId: "agency-1",
          userId: "user-editor",
          status: "ACTIVE",
          role: editorRole,
          roles: [{ role: editorRole }],
        } as any);
        repository.findAgencyRolesByIds.mockResolvedValue([editorRole] as any);

        await expect(
          service.updateMemberRole(
            "agency-1",
            "mem-editor",
            {
              roleId: "role-editor",
              roleIds: ["role-editor"],
              version: 2,
            },
            {
              authUserId: `auth-${roleKey.toLowerCase()}`,
              userId: `user-${roleKey.toLowerCase()}`,
              agencyId: "agency-1",
              membershipId: `mem-${roleKey.toLowerCase()}`,
              role: roleKey,
              roles: [roleKey],
            } as any,
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(repository.updateMembershipRole).not.toHaveBeenCalled();
      },
    );

    it("rejects assigning CLIENT to a business client outside the agency", async () => {
      repository.findMembershipById.mockResolvedValue({
        id: "mem-editor",
        agencyId: "agency-1",
        userId: "user-editor",
        status: "ACTIVE",
        role: editorRole,
        roles: [{ role: editorRole }],
      } as any);
      repository.findAgencyRolesByIds.mockResolvedValue([
        editorRole,
        clientRole,
      ] as any);
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(
          "agency-1",
          "mem-editor",
          {
            roleId: "role-editor",
            roleIds: ["role-editor", "role-client"],
            clientId: "client-other",
            version: 2,
          },
          ownerActor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateMembershipRole).not.toHaveBeenCalled();
    });

    it("updates the business client when CLIENT remains selected", async () => {
      const membership = {
        id: "mem-client",
        agencyId: "agency-1",
        userId: "user-client",
        status: "ACTIVE",
        role: clientRole,
        roles: [{ role: clientRole }],
        clientId: "client-1",
        user: { name: "Client", avatarUrl: null, authUser: null },
      };
      repository.findMembershipById.mockResolvedValue(membership as any);
      repository.findAgencyRolesByIds.mockResolvedValue([clientRole] as any);
      prisma.client.findFirst.mockResolvedValue({ id: "client-2" });
      repository.updateMembershipRole.mockResolvedValue({
        ...membership,
        clientId: "client-2",
        client: { id: "client-2", name: "New Client", displayName: null },
        joinedAt: new Date("2026-08-08T00:00:00.000Z"),
        version: 3,
      } as any);

      await service.updateMemberRole(
        "agency-1",
        "mem-client",
        {
          roleId: "role-client",
          roleIds: ["role-client"],
          clientId: "client-2",
          version: 2,
        },
        ownerActor,
      );

      expect(repository.updateMembershipRole).toHaveBeenCalledWith(
        "agency-1",
        "mem-client",
        "role-client",
        ["role-client"],
        2,
        "client-2",
        "auth-owner",
        "corr-123",
      );
    });

    it("clears clientId when CLIENT is removed and leaves other roles intact", async () => {
      const membership = {
        id: "mem-client-editor",
        agencyId: "agency-1",
        userId: "user-client-editor",
        status: "ACTIVE",
        role: editorRole,
        roles: [{ role: editorRole }, { role: clientRole }],
        clientId: "client-1",
        user: { name: "Editor", avatarUrl: null, authUser: null },
      };
      repository.findMembershipById.mockResolvedValue(membership as any);
      repository.findAgencyRolesByIds.mockResolvedValue([editorRole] as any);
      repository.updateMembershipRole.mockResolvedValue({
        ...membership,
        roles: [{ role: editorRole }],
        clientId: null,
        client: null,
        joinedAt: new Date("2026-08-08T00:00:00.000Z"),
        version: 3,
      } as any);

      await service.updateMemberRole(
        "agency-1",
        "mem-client-editor",
        { roleId: "role-editor", roleIds: ["role-editor"], version: 2 },
        ownerActor,
      );

      expect(repository.updateMembershipRole).toHaveBeenCalledWith(
        "agency-1",
        "mem-client-editor",
        "role-editor",
        ["role-editor"],
        2,
        null,
        "auth-owner",
        "corr-123",
      );
      expect(repository.createInvitation).not.toHaveBeenCalled();
    });

    it("does not let the local testing override change another member's roles", async () => {
      repository.findMembershipById.mockResolvedValue({
        id: "mem-other",
        agencyId: "agency-1",
        userId: "user-other",
        status: "ACTIVE",
        role: editorRole,
        roles: [{ role: editorRole }],
      } as any);
      repository.findAgencyRolesByIds.mockResolvedValue([ownerRole] as any);

      await expect(
        service.updateMemberRole(
          "agency-1",
          "mem-other",
          { roleId: "role-owner", roleIds: ["role-owner"], version: 2 },
          {
            authUserId: "auth-allowed",
            userId: "user-allowed",
            agencyId: "agency-1",
            membershipId: "mem-self",
            role: "EDITOR",
            roles: ["EDITOR"],
          } as any,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.updateMembershipRole).not.toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    it.each(["WRITER", "DOP"])(
      "rejects direct member removal from %s memberships",
      async (roleKey) => {
        await expect(
          service.removeMember("agency-1", "mem-target", 1, {
            authUserId: `auth-${roleKey.toLowerCase()}`,
            userId: `user-${roleKey.toLowerCase()}`,
            agencyId: "agency-1",
            membershipId: `mem-${roleKey.toLowerCase()}`,
            role: roleKey,
            roles: [roleKey],
          } as any),
        ).rejects.toThrow(ForbiddenException);

        expect(repository.removeMembership).not.toHaveBeenCalled();
      },
    );
  });
});
