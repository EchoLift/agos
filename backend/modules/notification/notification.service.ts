import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { EventBusService } from "@packages/events/event-bus.service";
import { DomainEvents } from "@packages/events/domain-event";
import {
  NotificationDeliveryIntent,
  NotificationRecipientType,
  isEmailChannelRequired,
} from "./notification.policy";

export interface NotifyInput {
  agencyId: string;
  userId: string;
  title: string;
  body: string;
  eventType: string;
  deliveryIntent?: NotificationDeliveryIntent;
  recipientType?: NotificationRecipientType;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Channel policy:
   * visibility-only events stay in-app; responsibility/action events can add email.
   */
  isEmailChannelRequired(input: string | NotifyInput): boolean {
    return isEmailChannelRequired(
      typeof input === "string"
        ? input
        : {
            eventType: input.eventType,
            deliveryIntent: input.deliveryIntent,
            recipientType: input.recipientType,
            metadata: input.metadata,
          },
    );
  }

  /**
   * Generic notification entry point for business modules.
   * Business modules call notify(...) without needing to decide email delivery logic.
   */
  async notify(input: NotifyInput) {
    this.logger.log(
      `Creating notification for user ${input.userId} in agency ${input.agencyId} [eventType: ${input.eventType}]`,
    );

    const notification = await this.prisma.notification.create({
      data: {
        agencyId: input.agencyId,
        userId: input.userId,
        title: input.title,
        body: input.body,
        eventType: input.eventType,
        ...(input.metadata ? { metadataJson: input.metadata } : {}),
      },
    });

    let deliveryId: string | null = null;

    if (this.isEmailChannelRequired(input)) {
      const delivery = await this.prisma.notificationDelivery.create({
        data: {
          agencyId: input.agencyId,
          notificationId: notification.id,
          channel: "EMAIL",
          status: "QUEUED",
        },
      });
      deliveryId = delivery.id;

      // Publish NotificationQueued with REFERENCE-ONLY payload ({ deliveryId })
      await this.eventBus.publish(DomainEvents.NotificationQueued, {
        agencyId: input.agencyId,
        actorId: null,
        aggregateId: delivery.id,
        aggregateType: "NotificationDelivery",
        payload: {
          deliveryId: delivery.id,
        },
      });
    }

    return {
      notification,
      deliveryId,
    };
  }

  /**
   * Legacy helper for backwards compatibility.
   */
  async createInAppNotification(input: {
    agencyId: string;
    userId: string;
    title: string;
    body: string;
    eventType: string;
  }) {
    return this.notify(input);
  }
}
