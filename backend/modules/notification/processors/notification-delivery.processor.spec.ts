import { Test, TestingModule } from "@nestjs/testing";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";
import { PrismaService } from "@packages/database/prisma.service";
import { FieldCryptoService } from "@packages/crypto/field-crypto.service";
import { ConfigService } from "@nestjs/config";
import { EventBusService } from "@packages/events/event-bus.service";
import { EmailDeliveryService } from "../email/services/email-delivery.service";
import { DomainEvents } from "@packages/events/domain-event";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const makeInvitation = (overrides: Partial<any> = {}) => ({
  id: "inv_55",
  agencyId: "agency_1",
  emailHash: "hash_xyz",
  token: "tok_abc123",
  status: "PENDING",
  expiresAt: new Date(Date.now() + 86400000), // 1 day from now
  agency: { id: "agency_1", name: "SociaExpert", displayName: "SociaExpert", slug: "sociaexpert" },
  ...overrides,
});

// ── Test suite ───────────────────────────────────────────────────────────────

describe("NotificationDeliveryProcessor", () => {
  let processor: NotificationDeliveryProcessor;
  let prisma: any;
  let crypto: any;
  let config: any;
  let emailDelivery: any;
  let eventBus: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
      notificationDelivery: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn(),
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
        if (key === "FRONTEND_URL") return "https://app.agencie.in";
        return undefined;
      }),
    };
    emailDelivery = {
      sendEmail: jest.fn(),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: FieldCryptoService, useValue: crypto },
        { provide: ConfigService, useValue: config },
        { provide: EventBusService, useValue: eventBus },
        { provide: EmailDeliveryService, useValue: emailDelivery },
      ],
    }).compile();

    processor = module.get<NotificationDeliveryProcessor>(NotificationDeliveryProcessor);
  });

  // ── Existing: Operational email delivery ───────────────────────────────────

  describe("processDelivery (Operational Emails)", () => {
    it("should process delivery successfully when membership is ACTIVE", async () => {
      const mockDelivery = {
        id: "deliv_100",
        agencyId: "agency_1",
        invitationId: null,
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
        invitationId: null,
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
      prisma.membership.findFirst.mockResolvedValue({ id: "mem_1", status: "SUSPENDED" });

      const result = await processor.processDelivery("deliv_101");

      expect(result).toBe(true);
      expect(emailDelivery.sendEmail).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: "deliv_101" },
        data: expect.objectContaining({ status: "CANCELLED" }),
      });
    });

    it("should skip processing immediately if delivery is already SENT", async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue({ id: "deliv_102", status: "SENT" });

      const result = await processor.processDelivery("deliv_102");

      expect(result).toBe(true);
      expect(prisma.agency.findUnique).not.toHaveBeenCalled();
      expect(emailDelivery.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── New: processInvitationDelivery regression tests ────────────────────────

  describe("processInvitationDelivery (regression)", () => {
    it("TEST-1: creates Notification + NotificationDelivery and publishes NotificationQueued for valid PENDING invitation", async () => {
      const invitation = makeInvitation();
      prisma.invitation.findUnique.mockResolvedValue(invitation);
      prisma.notificationDelivery.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: "notif-new" });
      prisma.notificationDelivery.create.mockResolvedValue({ id: "del-new" });

      await processor.processInvitationDelivery("inv_55");

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agencyId: "agency_1",
            userId: null,
            eventType: DomainEvents.MemberInvited,
          }),
        }),
      );
      expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invitationId: "inv_55",
            channel: "EMAIL",
            status: "QUEUED",
          }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        DomainEvents.NotificationQueued,
        expect.objectContaining({ payload: { deliveryId: "del-new" } }),
      );
    });

    it("TEST-2: is idempotent — skips DB creation and publish when NotificationDelivery already exists", async () => {
      const invitation = makeInvitation();
      prisma.invitation.findUnique.mockResolvedValue(invitation);
      prisma.notificationDelivery.findFirst.mockResolvedValue({ id: "del-existing", status: "QUEUED" });

      await processor.processInvitationDelivery("inv_55");

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("TEST-3: silently skips when invitation is not found (permanent skip, no throw)", async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);

      await expect(processor.processInvitationDelivery("inv-missing")).resolves.toBeUndefined();

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("TEST-4: silently skips when invitation is not PENDING (e.g. ACCEPTED)", async () => {
      prisma.invitation.findUnique.mockResolvedValue(makeInvitation({ status: "ACCEPTED" }));

      await expect(processor.processInvitationDelivery("inv_55")).resolves.toBeUndefined();

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("TEST-5: silently skips when invitation is expired", async () => {
      prisma.invitation.findUnique.mockResolvedValue(
        makeInvitation({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(processor.processInvitationDelivery("inv_55")).resolves.toBeUndefined();

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("TEST-6: throws (not swallowed) if DB transaction fails — ensures RabbitMQ does not ACK", async () => {
      const invitation = makeInvitation();
      prisma.invitation.findUnique.mockResolvedValue(invitation);
      prisma.notificationDelivery.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(new Error("DB connection lost"));

      await expect(processor.processInvitationDelivery("inv_55")).rejects.toThrow(
        "DB connection lost",
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("TEST-7: throws (not swallowed) if EventBus publish fails — ensures RabbitMQ does not ACK", async () => {
      const invitation = makeInvitation();
      prisma.invitation.findUnique.mockResolvedValue(invitation);
      prisma.notificationDelivery.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: "notif-new" });
      prisma.notificationDelivery.create.mockResolvedValue({ id: "del-new" });
      eventBus.publish.mockRejectedValue(new Error("RabbitMQ unavailable"));

      await expect(processor.processInvitationDelivery("inv_55")).rejects.toThrow(
        "RabbitMQ unavailable",
      );
    });
  });

  // ── New: processDelivery invitation branch ─────────────────────────────────

  describe("processDelivery — invitation branch", () => {
    it("decrypts invitation.emailEncrypted and sends email to unregistered invitee without AuthUser lookup", async () => {
      const invitation = makeInvitation({ emailEncrypted: "encrypted:unregistered@example.com" });
      const delivery = {
        id: "del-inv-1",
        agencyId: "agency_1",
        invitationId: "inv_55",
        status: "QUEUED",
        retryCount: 0,
        notification: {
          id: "notif-inv",
          userId: null,
          eventType: "MemberInvited",
          title: "Invited",
          body: "Join us",
        },
      };

      prisma.notificationDelivery.findUnique.mockResolvedValue(delivery);
      prisma.invitation.findUnique.mockResolvedValue(invitation);
      crypto.decrypt.mockImplementation((val: string) => {
        if (val === "encrypted:unregistered@example.com") return "unregistered@example.com";
        return val;
      });
      emailDelivery.sendEmail.mockResolvedValue({
        success: true,
        provider: "RESEND",
        providerMessageId: "msg-inv-123",
      });

      const result = await processor.processDelivery("del-inv-1");

      expect(result).toBe(true);
      expect(crypto.decrypt).toHaveBeenCalledWith("encrypted:unregistered@example.com");
      expect(emailDelivery.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "unregistered@example.com" }),
      );
      // emailHash should NOT be queried on AuthUser when emailEncrypted is on invitation
      expect(prisma.authUser.findUnique).not.toHaveBeenCalled();
      expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    });

    it("handles legacy invitations safely: marks CANCELLED and returns true when recipient email cannot be resolved (no infinite retry)", async () => {
      const legacyInvitation = makeInvitation({ emailEncrypted: null }); // legacy invitation without emailEncrypted
      const delivery = {
        id: "del-legacy",
        agencyId: "agency_1",
        invitationId: "inv_55",
        status: "QUEUED",
        retryCount: 0,
        notification: {
          id: "notif-legacy",
          userId: null,
          eventType: "MemberInvited",
          title: "Invited",
          body: "Join us",
        },
      };

      prisma.notificationDelivery.findUnique.mockResolvedValue(delivery);
      prisma.invitation.findUnique.mockResolvedValue(legacyInvitation);
      prisma.authUser.findUnique.mockResolvedValue(null); // Not registered yet

      const result = await processor.processDelivery("del-legacy");

      expect(result).toBe(true); // Processed gracefully (stopped retrying)
      expect(emailDelivery.sendEmail).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: "del-legacy" },
        data: expect.objectContaining({
          status: "CANCELLED",
          lastError: expect.stringContaining("Legacy invitation emailEncrypted missing"),
        }),
      });
    });
  });
});
