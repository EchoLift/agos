import { Test, TestingModule } from "@nestjs/testing";
import { NotificationService } from "./notification.service";
import { PrismaService } from "@packages/database/prisma.service";
import { EventBusService } from "@packages/events/event-bus.service";
import { DomainEvents } from "@packages/events/domain-event";

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
});
