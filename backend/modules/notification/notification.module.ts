import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { EmailDeliveryService } from "./email/services/email-delivery.service";
import { ResendProvider } from "./email/providers/resend.provider";
import { SendGridProvider } from "./email/providers/sendgrid.provider";
import { NotificationDeliveryProcessor } from "./processors/notification-delivery.processor";

@Module({
  providers: [
    NotificationService,
    EmailDeliveryService,
    ResendProvider,
    SendGridProvider,
    NotificationDeliveryProcessor,
  ],
  exports: [
    NotificationService,
    EmailDeliveryService,
    NotificationDeliveryProcessor,
  ],
})
export class NotificationModule {}
