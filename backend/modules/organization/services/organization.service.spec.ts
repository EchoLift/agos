import { Test, TestingModule } from "@nestjs/testing";
import { OrganizationService } from "./organization.service";
import { OrganizationRepository } from "../repositories/organization.repository";
import { UserLookupService } from "../../user/services/user-lookup.service";
import { CryptoService } from "../../auth/services/crypto.service";
import { RequestContextService } from "@packages/request-context/request-context.service";
import { PrismaService } from "@packages/database/prisma.service";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { User, Agency, Membership, Role, Invitation } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

describe("OrganizationService Unit Tests", () => {
  let service: OrganizationService;
  let repository: jest.Mocked<OrganizationRepository>;
  let userLookup: jest.Mocked<UserLookupService>;
  let cryptoService: jest.Mocked<CryptoService>;

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
      decrypt: jest.fn((value: string) => value),
    };

    const mockRequestContext = {
      get: jest
        .fn()
        .mockReturnValue({ correlationId: "corr-123", requestId: "req-123" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: OrganizationRepository, useValue: mockRepo },
        {
          provide: PrismaService,
          useValue: {
            systemRole: { upsert: jest.fn() },
            permission: { upsert: jest.fn() },
            systemRolePermission: { upsert: jest.fn() },
          },
        },
        { provide: UserLookupService, useValue: mockUserLookup },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: RequestContextService, useValue: mockRequestContext },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NODE_ENV") return "test";
              if (key === "DEV_ROLE_TESTING_OVERRIDE_ENABLED") return "false";
              if (key === "DEV_ROLE_TESTING_AUTH_USER_IDS") return "";
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
      } as Invitation;

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
  });

  describe("acceptInvitation", () => {
    it("should accept invitation and return new membership", async () => {
      const mockUser = { id: "user-2" } as User;
      const mockInvitation = {
        id: "inv-1",
        agencyId: "agency-1",
        roleId: "role-member",
      } as Invitation;
      const mockMembership = {
        id: "mem-new",
        agencyId: "agency-1",
        status: "ACTIVE",
      } as Membership;

      userLookup.findByAuthUserId.mockResolvedValue(mockUser);
      repository.findInvitationByToken.mockResolvedValue(mockInvitation);
      repository.findMembership.mockResolvedValue(null);
      repository.acceptInvitation.mockResolvedValue(mockMembership);

      const result = await service.acceptInvitation("token-123", "auth-2");

      expect(result.membershipId).toBe("mem-new");
      expect(result.status).toBe("ACTIVE");
    });

    it("should throw ConflictException if user is already a member", async () => {
      userLookup.findByAuthUserId.mockResolvedValue({ id: "user-2" } as User);
      repository.findInvitationByToken.mockResolvedValue({
        id: "inv-1",
        agencyId: "agency-1",
      } as Invitation);
      repository.findMembership.mockResolvedValue({
        id: "mem-existing",
      } as Membership);

      await expect(
        service.acceptInvitation("token-123", "auth-2"),
      ).rejects.toThrow(ConflictException);
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
});
