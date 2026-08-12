import { Injectable, Logger } from "@nestjs/common";
import { ResendProvider } from "../providers/resend.provider";
import { SendGridProvider } from "../providers/sendgrid.provider";
import {
  EmailMessage,
  EmailSendResult,
} from "../interfaces/email-provider.interface";
import {
  isTransientFailure,
  SemanticFailureCategory,
} from "../interfaces/semantic-failure.enum";

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(
    private readonly resendProvider: ResendProvider,
    private readonly sendGridProvider: SendGridProvider,
  ) {}

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    // 1. Try Primary: ResendProvider
    if (this.resendProvider.isConfigured()) {
      this.logger.log(`Attempting email delivery via Resend to ${message.to}`);
      const resendResult = await this.resendProvider.send(message);

      if (resendResult.success) {
        return resendResult;
      }

      // Check if failure allows failover
      const category =
        resendResult.failureCategory ?? SemanticFailureCategory.UNKNOWN_PERMANENT;

      if (!isTransientFailure(category)) {
        this.logger.warn(
          `Resend failed with permanent category [${category}]. Not attempting fallback.`,
        );
        return resendResult;
      }

      this.logger.warn(
        `Resend failed with transient category [${category}]. Evaluating SendGrid fallback.`,
      );

      // Attempt fallback to SendGrid if configured
      if (this.sendGridProvider.isConfigured()) {
        this.logger.log(
          `Failing over to SendGrid provider for delivery to ${message.to}`,
        );
        return this.sendGridProvider.send(message);
      }

      return resendResult;
    }

    // 2. If Resend is unconfigured, try SendGrid fallback directly
    if (this.sendGridProvider.isConfigured()) {
      this.logger.log(
        `Resend unconfigured. Delivering via SendGrid fallback to ${message.to}`,
      );
      return this.sendGridProvider.send(message);
    }

    this.logger.warn("No email providers are configured");
    return {
      success: false,
      provider: "NONE",
      failureCategory: SemanticFailureCategory.PROVIDER_UNAVAILABLE,
      error: "No email provider configured (both Resend and SendGrid unavailable)",
    };
  }
}
