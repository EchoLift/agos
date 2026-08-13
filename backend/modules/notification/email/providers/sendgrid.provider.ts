import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "../interfaces/email-provider.interface";
import { SemanticFailureCategory } from "../interfaces/semantic-failure.enum";

@Injectable()
export class SendGridProvider implements EmailProvider {
  readonly name = "SENDGRID";
  private readonly logger = new Logger(SendGridProvider.name);

  constructor(private readonly config: ConfigService) { }

  isConfigured(): boolean {
    const apiKey = this.config.get<string>("SENDGRID_API_KEY");
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = this.config.get<string>("SENDGRID_API_KEY");
    const defaultFromEmail =
      this.config.get<string>("SENDGRID_FROM_EMAIL") ??
      "notifications@calcie.fun";
    const defaultFromName =
      this.config.get<string>("SENDGRID_FROM_NAME") ?? "AGENCIE";

    if (!apiKey) {
      this.logger.warn("SendGrid API key is not configured");
      return {
        success: false,
        provider: this.name,
        failureCategory: SemanticFailureCategory.PROVIDER_UNAVAILABLE,
        error: "SENDGRID_API_KEY not configured",
      };
    }

    const fromObject = this.parseFromAddress(
      message.from,
      defaultFromEmail,
      defaultFromName,
    );

    const payload = {
      personalizations: [
        {
          to: [{ email: message.to }],
        },
      ],
      from: fromObject,
      subject: message.subject,
      content: [
        { type: "text/plain", value: message.text },
        { type: "text/html", value: message.html },
      ],
      ...(message.replyTo ? { reply_to: { email: message.replyTo } } : {}),
    };

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status >= 200 && response.status < 300) {
        const messageId =
          response.headers.get("x-message-id") ||
          `sg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        return {
          success: true,
          provider: this.name,
          providerMessageId: messageId,
        };
      }

      const responseData = (await response.json().catch(() => ({}))) as Record<
        string,
        any
      >;
      const category = this.classifySendGridError(
        response.status,
        responseData,
      );
      const errorMessage =
        responseData.errors?.[0]?.message ||
        `HTTP ${response.status}: Failed to send email via SendGrid`;

      this.logger.warn(
        `SendGrid send failed [${category}]: ${errorMessage} (status ${response.status})`,
      );

      return {
        success: false,
        provider: this.name,
        failureCategory: category,
        error: errorMessage,
      };
    } catch (err: any) {
      this.logger.error(
        "Network / unexpected error sending email via SendGrid",
        err,
      );
      return {
        success: false,
        provider: this.name,
        failureCategory: SemanticFailureCategory.UNKNOWN_TRANSIENT,
        error: err.message || "Network request failed",
      };
    }
  }

  private parseFromAddress(
    fromStr: string | undefined,
    defaultEmail: string,
    defaultName: string,
  ): { email: string; name?: string } {
    if (!fromStr) {
      return { email: defaultEmail, name: defaultName };
    }

    // Match "Name <email@domain.com>" format
    const match = fromStr.match(/^([^<]+)<([^>]+)>$/);
    if (match) {
      return {
        name: match[1].trim(),
        email: match[2].trim(),
      };
    }

    return { email: fromStr.trim() };
  }

  private classifySendGridError(
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
      messageStr.includes("does not end with a valid domain") ||
      messageStr.includes("bad request")
    ) {
      return SemanticFailureCategory.RECIPIENT_INVALID;
    }
    if (
      messageStr.includes("suppressed") ||
      messageStr.includes("unsubscribed") ||
      messageStr.includes("bounce")
    ) {
      return SemanticFailureCategory.RECIPIENT_SUPPRESSED;
    }
    if (messageStr.includes("spam") || messageStr.includes("policy")) {
      return SemanticFailureCategory.POLICY_REJECTED;
    }

    return SemanticFailureCategory.UNKNOWN_PERMANENT;
  }
}
