import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "../interfaces/email-provider.interface";
import { SemanticFailureCategory } from "../interfaces/semantic-failure.enum";

@Injectable()
export class ResendProvider implements EmailProvider {
  readonly name = "RESEND";
  private readonly logger = new Logger(ResendProvider.name);

  constructor(private readonly config: ConfigService) { }

  isConfigured(): boolean {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const defaultFrom =
      this.config.get<string>("RESEND_FROM_EMAIL") ??
      "AGENCIE <notifications@calcie.fun>";

    if (!apiKey) {
      this.logger.warn("Resend API key is not configured");
      return {
        success: false,
        provider: this.name,
        failureCategory: SemanticFailureCategory.PROVIDER_UNAVAILABLE,
        error: "RESEND_API_KEY not configured",
      };
    }

    const payload = {
      from: message.from ?? defaultFrom,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo,
    };

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = (await response.json().catch(() => ({}))) as Record<
        string,
        any
      >;

      if (response.ok && responseData.id) {
        return {
          success: true,
          provider: this.name,
          providerMessageId: String(responseData.id),
        };
      }

      const category = this.classifyResendError(response.status, responseData);
      const errorMessage =
        responseData.message ||
        responseData.name ||
        `HTTP ${response.status}: Failed to send email via Resend`;

      this.logger.warn(
        `Resend send failed [${category}]: ${errorMessage} (status ${response.status})`,
      );

      return {
        success: false,
        provider: this.name,
        failureCategory: category,
        error: errorMessage,
      };
    } catch (err: any) {
      this.logger.error("Network / unexpected error sending email via Resend", err);
      return {
        success: false,
        provider: this.name,
        failureCategory: SemanticFailureCategory.UNKNOWN_TRANSIENT,
        error: err.message || "Network request failed",
      };
    }
  }

  private classifyResendError(
    status: number,
    data: Record<string, any>,
  ): SemanticFailureCategory {
    if (status === 429) {
      return SemanticFailureCategory.RATE_LIMITED;
    }
    if (status === 401 || status === 403) {
      return SemanticFailureCategory.PROVIDER_AUTH_FAILURE;
    }
    if (status >= 500) {
      return SemanticFailureCategory.PROVIDER_UNAVAILABLE;
    }

    const messageStr = JSON.stringify(data).toLowerCase();

    if (
      messageStr.includes("invalid email") ||
      messageStr.includes("recipient") ||
      messageStr.includes("invalid to")
    ) {
      return SemanticFailureCategory.RECIPIENT_INVALID;
    }
    if (
      messageStr.includes("suppressed") ||
      messageStr.includes("bounced") ||
      messageStr.includes("unsubscribed")
    ) {
      return SemanticFailureCategory.RECIPIENT_SUPPRESSED;
    }
    if (
      messageStr.includes("spam") ||
      messageStr.includes("policy") ||
      messageStr.includes("domain")
    ) {
      return SemanticFailureCategory.POLICY_REJECTED;
    }
    if (status === 400 || status === 422) {
      return SemanticFailureCategory.MESSAGE_INVALID;
    }

    return SemanticFailureCategory.UNKNOWN_PERMANENT;
  }
}
