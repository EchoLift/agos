import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@packages/events/rabbitmq.service";
import { NotificationDeliveryProcessor } from "@modules/notification/processors/notification-delivery.processor";

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly processor: NotificationDeliveryProcessor,
  ) {}

  async onModuleInit() {
    // 1. Subscribe to NotificationQueued events
    await this.rabbitmq.subscribe(
      "notification_module.email_delivery",
      "event.NotificationQueued",
      async (msg) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const event = JSON.parse(content);
          const deliveryId = event.payload?.deliveryId || event.aggregateId;

          this.logger.log(
            `Consuming NotificationQueued event for deliveryId: ${deliveryId}`,
          );

          if (!deliveryId) {
            this.logger.warn("NotificationQueued event missing deliveryId");
            return;
          }

          await this.processor.processDelivery(deliveryId);
        } catch (error) {
          this.logger.error("Failed to process NotificationQueued event", error);
          throw error;
        }
      },
    );

    // 2. Subscribe to MemberInvited events
    await this.rabbitmq.subscribe(
      "notification_module.member_invited",
      "event.MemberInvited",
      async (msg) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const event = JSON.parse(content);
          // Payload is reference-only: never extract raw email from event
          const invitationId = event.payload?.invitationId || event.aggregateId;

          this.logger.log(
            `Consuming MemberInvited event for invitationId: ${invitationId}`,
          );

          if (!invitationId) {
            this.logger.warn("MemberInvited event missing invitationId");
            return;
          }

          // Creates Notification + NotificationDelivery rows and publishes NotificationQueued.
          // Throws on DB/publish failure so RabbitMQ does not ACK prematurely.
          await this.processor.processInvitationDelivery(invitationId);
        } catch (error) {
          this.logger.error("Failed to process MemberInvited event", error);
          throw error;
        }
      },
    );
  }
}
