import { Test, TestingModule } from "@nestjs/testing";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";
import { PrismaService } from "@packages/database/prisma.service";
import { FieldCryptoService } from "@packages/crypto/field-crypto.service";
import { ConfigService } from "@nestjs/config";
import { EmailDeliveryService } from "../email/services/email-delivery.service";

describe("NotificationDeliveryProcessor", () => {
  let processor: NotificationDeliveryProcessor;
  let prisma: any;
  let crypto: any;
  let config: any;
  let emailDelivery: any;

  beforeEach(async () => {
    prisma = {
      notificationDelivery: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agency: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      membership: {
        findFirst: jest.fn(),
      },
      invitation: {
        findUnique: jest.fn(),
      },
      authUser: {
        findUnique: jest.fn(),
      },
    };
    crypto = {
      decrypt: jest.fn(),
    };
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "FRONTEND_URL") return "https://client-agos.calcie.fun";
        return undefined;
      }),
    };
    emailDelivery = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: FieldCryptoService, useValue: crypto },
        { provide: ConfigService, useValue: config },
        { provide: EmailDeliveryService, useValue: emailDelivery },
      ],
    }).compile();

    processor = module.get<NotificationDeliveryProcessor>(
      NotificationDeliveryProcessor,
    );
  });

  describe("processDelivery (Operational Emails)", () => {
    it("should process delivery successfully when membership is ACTIVE", async () => {
      const mockDelivery = {
        id: "deliv_100",
        agencyId: "agency_1",
        status: "QUEUED",
        retryCount: 0,
        notification: {
          id: "notif_100",
          userId: "user_1",
          title: "Task Assigned",
          body: "Task description",
          eventType: "WorkflowTaskAssigned",
        },
      };
      const mockAgency = { id: "agency_1", name: "SociaExpert", slug: "sociaexpert" };
      const mockUser = {
        id: "user_1",
        name: "Surya",
        authUser: { id: "auth_1", emailEncrypted: "encrypted_email" },
      };
      const mockMembership = { id: "mem_1", status: "ACTIVE" };

      prisma.notificationDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.agency.findUnique.mockResolvedValue(mockAgency);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.membership.findFirst.mockResolvedValue(mockMembership);
      crypto.decrypt.mockReturnValue("surya@example.com");
      emailDelivery.sendEmail.mockResolvedValue({
        success: true,
        provider: "RESEND",
        providerMessageId: "msg_999",
      });

      const result = await processor.processDelivery("deliv_100");

      expect(result).toBe(true);
      expect(crypto.decrypt).toHaveBeenCalledWith("encrypted_email");
      expect(emailDelivery.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "surya@example.com",
          subject: expect.stringContaining("Task Assigned"),
        }),
      );
      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: "deliv_100" },
        data: expect.objectContaining({
          status: "SENT",
          provider: "RESEND",
          providerMessageId: "msg_999",
        }),
      });
    });

    it("should skip delivery and mark CANCELLED when user membership in agency is NOT active", async () => {
      const mockDelivery = {
        id: "deliv_101",
        agencyId: "agency_1",
        status: "QUEUED",
        retryCount: 0,
        notification: {
          id: "notif_101",
          userId: "user_1",
          title: "Task Assigned",
          body: "Task description",
          eventType: "WorkflowTaskAssigned",
        },
      };
      const mockAgency = { id: "agency_1", name: "SociaExpert", slug: "sociaexpert" };
      const mockUser = {
        id: "user_1",
        name: "Surya",
        authUser: { id: "auth_1", emailEncrypted: "encrypted_email" },
      };

      prisma.notificationDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.agency.findUnique.mockResolvedValue(mockAgency);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // Membership status is SUSPENDED
      prisma.membership.findFirst.mockResolvedValue({ id: "mem_1", status: "SUSPENDED" });

      const result = await processor.processDelivery("deliv_101");

      expect(result).toBe(true);
      expect(emailDelivery.sendEmail).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: "deliv_101" },
        data: expect.objectContaining({
          status: "CANCELLED",
        }),
      });
    });

    it("should skip processing immediately if delivery is already SENT", async () => {
      const mockDelivery = {
        id: "deliv_102",
        status: "SENT",
      };

      prisma.notificationDelivery.findUnique.mockResolvedValue(mockDelivery);

      const result = await processor.processDelivery("deliv_102");

      expect(result).toBe(true);
      expect(prisma.agency.findUnique).not.toHaveBeenCalled();
      expect(emailDelivery.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("processInvitationDelivery", () => {
    it("should process invitation delivery without requiring ACTIVE membership", async () => {
      const mockInvitation = {
        id: "inv_55",
        agencyId: "agency_1",
        status: "PENDING",
        token: "tok_abc123",
        emailHash: "hash_xyz",
        expiresAt: new Date(Date.now() + 86400000), // 1 day in future
        agency: { name: "SociaExpert", slug: "sociaexpert" },
        role: { displayName: "Creator" },
      };

      prisma.invitation.findUnique.mockResolvedValue(mockInvitation);
      emailDelivery.sendEmail.mockResolvedValue({
        success: true,
        provider: "RESEND",
        providerMessageId: "msg_inv_1",
      });

      const result = await processor.processInvitationDelivery("inv_55", "invitee@example.com");

      expect(result).toBe(true);
      expect(emailDelivery.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "invitee@example.com",
          subject: expect.stringContaining("invited to join SociaExpert"),
        }),
      );
    });
  });
});
