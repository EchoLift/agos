import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { NotificationService } from "./notification.service";
import { PrismaService } from "@packages/database/prisma.service";
import { EventBusService } from "@packages/events/event-bus.service";
import { DomainEvents } from "@packages/events/domain-event";
import {
  NotificationDeliveryIntent,
  isEmailChannelRequired,
} from "./notification.policy";

describe("NotificationService", () => {
  let service: NotificationService;
  let prisma: any;
  let eventBus: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
      },
      notificationDelivery: {
        create: jest.fn(),
      },
    };
    eventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it("should create in-app notification and queue EMAIL delivery for high-priority event", async () => {
    const mockNotification = {
      id: "notif_1",
      agencyId: "agency_1",
      userId: "user_1",
      title: "Gig Assigned",
      body: "You have new work",
      eventType: DomainEvents.WorkOrderCreated,
    };
    const mockDelivery = {
      id: "deliv_1",
      agencyId: "agency_1",
      notificationId: "notif_1",
      channel: "EMAIL",
      status: "QUEUED",
    };

    prisma.notification.create.mockResolvedValue(mockNotification);
    prisma.notificationDelivery.create.mockResolvedValue(mockDelivery);

    const result = await service.notify({
      agencyId: "agency_1",
      userId: "user_1",
      title: "Gig Assigned",
      body: "You have new work",
      eventType: DomainEvents.WorkOrderCreated,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        agencyId: "agency_1",
        userId: "user_1",
        title: "Gig Assigned",
        body: "You have new work",
        eventType: DomainEvents.WorkOrderCreated,
      },
    });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: {
        agencyId: "agency_1",
        notificationId: "notif_1",
        channel: "EMAIL",
        status: "QUEUED",
      },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.NotificationQueued,
      expect.objectContaining({
        agencyId: "agency_1",
        aggregateId: "deliv_1",
        payload: { deliveryId: "deliv_1" },
      }),
    );
    expect(result.deliveryId).toBe("deliv_1");
  });

  it("persists metadata for queued operational notifications", async () => {
    const mockNotification = {
      id: "notif_report",
      agencyId: "agency_1",
      userId: "user_1",
      title: "Reports ready",
      body: "August reports are ready",
      eventType: "ClientReportReady",
      metadataJson: {
        deepLink: "https://social-expert.agencie.in/files",
        reportPeriodLabel: "August 2026",
      },
    };
    const mockDelivery = {
      id: "deliv_report",
      agencyId: "agency_1",
      notificationId: "notif_report",
      channel: "EMAIL",
      status: "QUEUED",
    };

    prisma.notification.create.mockResolvedValue(mockNotification);
    prisma.notificationDelivery.create.mockResolvedValue(mockDelivery);

    await service.notify({
      agencyId: "agency_1",
      userId: "user_1",
      title: "Reports ready",
      body: "August reports are ready",
      eventType: "ClientReportReady",
      deliveryIntent: NotificationDeliveryIntent.ClientActionRequired,
      recipientType: "CLIENT",
      metadata: {
        deepLink: "https://social-expert.agencie.in/files",
        reportPeriodLabel: "August 2026",
      },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "ClientReportReady",
        metadataJson: {
          deepLink: "https://social-expert.agencie.in/files",
          reportPeriodLabel: "August 2026",
        },
      }),
    });
  });

  it("should create in-app notification ONLY (no email delivery) for low-priority event", async () => {
    const mockNotification = {
      id: "notif_2",
      agencyId: "agency_1",
      userId: "user_1",
      title: "Daily Digest",
      body: "Summary",
      eventType: "DailyDigest",
    };

    prisma.notification.create.mockResolvedValue(mockNotification);

    const result = await service.notify({
      agencyId: "agency_1",
      userId: "user_1",
      title: "Daily Digest",
      body: "Summary",
      eventType: "DailyDigest",
    });

    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(result.deliveryId).toBeNull();
  });

  it("keeps campaign visibility events in-app only", async () => {
    const mockNotification = {
      id: "notif_campaign",
      agencyId: "agency_1",
      userId: "user_1",
      title: "Campaign created",
      body: "Nike Summer Reel is visible in your workspace.",
      eventType: DomainEvents.CampaignCreated,
    };

    prisma.notification.create.mockResolvedValue(mockNotification);

    const result = await service.notify({
      agencyId: "agency_1",
      userId: "user_1",
      title: "Campaign created",
      body: "Nike Summer Reel is visible in your workspace.",
      eventType: DomainEvents.CampaignCreated,
    });

    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(result.deliveryId).toBeNull();
  });

  it("does not email generic workflow stage visibility changes", async () => {
    expect(isEmailChannelRequired(DomainEvents.WorkflowStageChanged)).toBe(
      false,
    );
  });

  it("allows workflow stage events to email only when explicitly action-required", async () => {
    expect(
      isEmailChannelRequired({
        eventType: DomainEvents.WorkflowStageChanged,
        deliveryIntent: NotificationDeliveryIntent.TimeSensitiveAction,
      }),
    ).toBe(true);
  });

  it("emails only material assignment updates", async () => {
    expect(
      isEmailChannelRequired({
        eventType: DomainEvents.WorkOrderUpdated,
        metadata: { materialUpdateType: "DUE_DATE_CHANGED" },
      }),
    ).toBe(true);

    expect(
      isEmailChannelRequired({
        eventType: DomainEvents.WorkOrderUpdated,
        metadata: { materialUpdateType: "COLOR_CHANGED" },
      }),
    ).toBe(false);
  });
});
