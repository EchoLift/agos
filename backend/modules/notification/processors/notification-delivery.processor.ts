import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { FieldCryptoService } from "@packages/crypto/field-crypto.service";
import { ConfigService } from "@nestjs/config";
import { EmailDeliveryService } from "../email/services/email-delivery.service";
import {
  buildDeepLink,
  renderEmailTemplate,
} from "../email/templates/email-templates";

@Injectable()
export class NotificationDeliveryProcessor {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldCryptoService,
    private readonly config: ConfigService,
    private readonly emailDelivery: EmailDeliveryService,
  ) {}

  /**
   * Process a queued NotificationDelivery using its reference deliveryId.
   */
  async processDelivery(deliveryId: string): Promise<boolean> {
    this.logger.log(`Processing email delivery ID: ${deliveryId}`);

    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        notification: true,
      },
    });

    if (!delivery) {
      this.logger.warn(`NotificationDelivery record not found: ${deliveryId}`);
      return false;
    }

    if (delivery.status === "SENT" || delivery.status === "CANCELLED") {
      this.logger.log(`Delivery ${deliveryId} is already ${delivery.status}. Skipping.`);
      return true;
    }

    const { agencyId, notification } = delivery;

    // Load agency
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency || agency.deletedAt) {
      this.logger.warn(`Agency ${agencyId} invalid or deleted for delivery ${deliveryId}`);
      await this.markCancelled(deliveryId, "Agency deleted or not found");
      return false;
    }

    // Load target user profile and auth user
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      include: { authUser: true },
    });

    if (!user || !user.authUser) {
      this.logger.warn(`User / AuthUser not found for userId: ${notification.userId}`);
      await this.markFailed(deliveryId, "Target user identity not found", 1);
      return false;
    }

    // Operational Email check: Membership MUST be ACTIVE for target agency
    const membership = await this.prisma.membership.findFirst({
      where: {
        agencyId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      this.logger.warn(
        `User ${user.id} membership in agency ${agencyId} is not ACTIVE (status: ${membership?.status ?? "NONE"}). Skipping operational email.`,
      );
      await this.markCancelled(
        deliveryId,
        `User membership status is ${membership?.status ?? "NON_MEMBER"}`,
      );
      return true;
    }

    // Decrypt universal recipient email
    let recipientEmail: string;
    try {
      recipientEmail = this.crypto.decrypt(user.authUser.emailEncrypted);
    } catch (err: any) {
      this.logger.error(`Failed to decrypt email for authUser ${user.authUser.id}`, err);
      await this.markFailed(deliveryId, "Email decryption failed", delivery.retryCount + 1);
      return false;
    }

    const frontendUrl =
      this.config.get<string>("FRONTEND_URL") || "https://client-agos.calcie.fun";

    const rendered = renderEmailTemplate(notification.eventType, {
      recipientName: user.name || "Team Member",
      agencyName: agency.displayName || agency.name,
      agencySlug: agency.slug,
      title: notification.title,
      body: notification.body,
      deepLink: buildDeepLink(frontendUrl, `${agency.slug}`),
      frontendUrl,
    });

    const result = await this.emailDelivery.sendEmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (result.success) {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SENT",
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
        },
      });
      this.logger.log(
        `Successfully sent email delivery ${deliveryId} via ${result.provider} (ID: ${result.providerMessageId})`,
      );
      return true;
    }

    // Delivery failed
    await this.markFailed(
      deliveryId,
      result.error || `Failed via ${result.provider}`,
      delivery.retryCount + 1,
      result.provider,
    );
    return false;
  }

  /**
   * Process a MemberInvited event using reference invitationId.
   * Invitation emails DO NOT require an ACTIVE membership, but validate that Invitation is PENDING and not expired.
   */
  async processInvitationDelivery(invitationId: string, emailOverride?: string): Promise<boolean> {
    this.logger.log(`Processing invitation email delivery for invitationId: ${invitationId}`);

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        agency: true,
        role: true,
      },
    });

    if (!invitation) {
      this.logger.warn(`Invitation ${invitationId} not found`);
      return false;
    }

    if (invitation.status !== "PENDING") {
      this.logger.log(`Invitation ${invitationId} status is ${invitation.status}. Skipping email.`);
      return true;
    }

    if (invitation.expiresAt < new Date()) {
      this.logger.warn(`Invitation ${invitationId} is expired.`);
      return false;
    }

    // Resolve target recipient email
    let targetEmail = emailOverride;

    if (!targetEmail) {
      // Look up AuthUser by emailHash if user already registered
      const authUser = await this.prisma.authUser.findUnique({
        where: { emailHash: invitation.emailHash },
      });
      if (authUser?.emailEncrypted) {
        try {
          targetEmail = this.crypto.decrypt(authUser.emailEncrypted);
        } catch {
          // Ignore fallback
        }
      }
    }

    if (!targetEmail) {
      this.logger.warn(`Cannot resolve recipient email for invitation ${invitationId}`);
      return false;
    }

    const frontendUrl =
      this.config.get<string>("FRONTEND_URL") || "https://client-agos.calcie.fun";

    const rendered = renderEmailTemplate("MemberInvited", {
      recipientName: "Team Member",
      agencyName: invitation.agency.displayName || invitation.agency.name,
      agencySlug: invitation.agency.slug,
      title: `You're invited to join ${invitation.agency.name}`,
      token: invitation.token,
      deepLink: buildDeepLink(frontendUrl, `login?invite=${invitation.token}`),
      frontendUrl,
    });

    const result = await this.emailDelivery.sendEmail({
      to: targetEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (result.success) {
      this.logger.log(
        `Sent invitation email for ${invitationId} to ${targetEmail} via ${result.provider}`,
      );
      return true;
    }

    this.logger.warn(`Failed to send invitation email for ${invitationId}: ${result.error}`);
    return false;
  }

  private async markCancelled(deliveryId: string, reason: string) {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "CANCELLED",
        lastError: reason,
      },
    });
  }

  private async markFailed(
    deliveryId: string,
    error: string,
    retryCount: number,
    provider?: string,
  ) {
    const maxRetries = 3;
    const isExhausted = retryCount >= maxRetries;
    const nextRetryAt = isExhausted
      ? null
      : new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000); // Exponential backoff: 2m, 4m, 8m

    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: isExhausted ? "FAILED" : "QUEUED",
        retryCount,
        lastError: error,
        provider: provider ?? undefined,
        nextRetryAt,
      },
    });
  }
}
