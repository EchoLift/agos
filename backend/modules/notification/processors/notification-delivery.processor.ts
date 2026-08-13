import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { FieldCryptoService } from "@packages/crypto/field-crypto.service";
import { ConfigService } from "@nestjs/config";
import { EventBusService } from "@packages/events/event-bus.service";
import { DomainEvents } from "@packages/events/domain-event";
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
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Process a queued NotificationDelivery using its reference deliveryId.
   */
  async processDelivery(deliveryId: string): Promise<boolean> {
    this.logger.log(`Processing email delivery ID: ${deliveryId}`);

    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: { notification: true },
    });

    if (!delivery) {
      this.logger.warn(`NotificationDelivery record not found: ${deliveryId}`);
      return false;
    }

    if (delivery.status === "SENT" || delivery.status === "CANCELLED") {
      this.logger.log(`Delivery ${deliveryId} is already ${delivery.status}. Skipping.`);
      return true;
    }

    // --- INVITATION BRANCH ---
    // Invitation deliveries have invitationId set and no userId on the Notification.
    // They bypass the user/membership check and resolve recipient email via emailHash.
    if (delivery.invitationId) {
      return this.processInvitationEmailSend(delivery, deliveryId);
    }

    // --- OPERATIONAL BRANCH ---
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

    // Load target user profile and auth user (userId is non-null for operational notifications)
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId! },
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
      this.config.get<string>("FRONTEND_URL") || "https://app.agencie.in";

    const rendered = renderEmailTemplate(notification.eventType, {
      recipientName: user.name || "Team Member",
      agencyName: agency.displayName || agency.name,
      agencySlug: agency.slug,
      title: notification.title,
      body: notification.body,
      deepLink: buildDeepLink(frontendUrl, "", agency.slug),
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

    await this.markFailed(
      deliveryId,
      result.error || `Failed via ${result.provider}`,
      delivery.retryCount + 1,
      result.provider,
    );
    return false;
  }

  /**
   * Send the actual invitation email for a delivery that was created from a MemberInvited event.
   * Resolves recipient email authoritatively from the Invitation (via emailHash → AuthUser).
   */
  private async processInvitationEmailSend(
    delivery: { id: string; invitationId: string | null; retryCount: number; agencyId: string },
    deliveryId: string,
  ): Promise<boolean> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: delivery.invitationId! },
      include: { agency: true },
    });

    if (!invitation) {
      this.logger.warn(`Invitation ${delivery.invitationId} not found for delivery ${deliveryId}`);
      await this.markCancelled(deliveryId, "Invitation not found");
      return false;
    }

    if (invitation.status !== "PENDING") {
      this.logger.log(
        `Invitation ${invitation.id} status is ${invitation.status}; cancelling delivery ${deliveryId}`,
      );
      await this.markCancelled(deliveryId, `Invitation status is ${invitation.status}`);
      return true;
    }

    if (invitation.expiresAt < new Date()) {
      this.logger.warn(`Invitation ${invitation.id} is expired; cancelling delivery ${deliveryId}`);
      await this.markCancelled(deliveryId, "Invitation expired");
      return false;
    }

    // Resolve recipient email:
    // 1. Primary source: Decrypt invitation.emailEncrypted (persisted at invitation creation)
    let recipientEmail: string | null = null;
    if (invitation.emailEncrypted) {
      try {
        recipientEmail = this.crypto.decrypt(invitation.emailEncrypted);
      } catch (err) {
        this.logger.error(`Failed to decrypt emailEncrypted for invitation ${invitation.id}`);
      }
    }

    // 2. Fallback: Lookup AuthUser by emailHash (for existing registered users / legacy compatibility)
    if (!recipientEmail) {
      const authUser = await this.prisma.authUser.findUnique({
        where: { emailHash: invitation.emailHash },
      });
      if (authUser?.emailEncrypted) {
        try {
          recipientEmail = this.crypto.decrypt(authUser.emailEncrypted);
        } catch {
          // fall through to check below
        }
      }
    }

    // 3. Handle unresolvable legacy invitations safely (do not retry infinitely)
    if (!recipientEmail) {
      this.logger.warn(
        `Cannot resolve recipient email for invitation ${invitation.id}; cancelling delivery (legacy/unresolvable)`,
      );
      await this.markCancelled(
        deliveryId,
        "Legacy invitation emailEncrypted missing and unresolvable",
      );
      return true; // Stop scheduling retries for unrecoverable legacy invitation
    }

    const frontendUrl =
      this.config.get<string>("FRONTEND_URL") || "https://app.agencie.in";

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
        `Sent invitation email for ${invitation.id} via ${result.provider} (msgId: ${result.providerMessageId})`,
      );
      return true;
    }

    this.logger.warn(
      `Failed to send invitation email for ${invitation.id}: ${result.error} (category: ${result.failureCategory})`,
    );
    await this.markFailed(
      deliveryId,
      result.error || `Failed via ${result.provider}`,
      delivery.retryCount + 1,
      result.provider,
    );
    return false;
  }

  /**
   * Process a MemberInvited event by creating Notification + NotificationDelivery rows
   * and publishing NotificationQueued { deliveryId } to route to the email_delivery queue.
   *
   * Invitation emails DO NOT require ACTIVE membership — only that the Invitation is PENDING and not expired.
   * The actual email send happens downstream in processDelivery() via notification_module.email_delivery.
   *
   * Idempotent: if a NotificationDelivery already exists for this invitationId + EMAIL channel,
   * we skip creation and do NOT re-publish (prevents duplicate sends on MemberInvited redelivery).
   *
   * THROWS on DB or publish failure so that RabbitMQ does NOT ACK the MemberInvited message.
   */
  async processInvitationDelivery(invitationId: string): Promise<void> {
    this.logger.log(`Queuing invitation email delivery for invitationId: ${invitationId}`);

    // --- 1. Validate invitation ---
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { agency: true },
    });

    if (!invitation) {
      // Invitation not found — treat as permanent skip (do not retry)
      this.logger.warn(`Invitation ${invitationId} not found; skipping email delivery`);
      return;
    }

    if (invitation.status !== "PENDING") {
      this.logger.log(
        `Invitation ${invitationId} status is ${invitation.status}; skipping email delivery`,
      );
      return;
    }

    if (invitation.expiresAt < new Date()) {
      this.logger.warn(`Invitation ${invitationId} is expired; skipping email delivery`);
      return;
    }

    // --- 2. Idempotency check: skip if delivery already queued/sent for this invitation ---
    const existing = await this.prisma.notificationDelivery.findFirst({
      where: { invitationId, channel: "EMAIL" },
    });
    if (existing) {
      this.logger.log(
        `NotificationDelivery already exists (id: ${existing.id}, status: ${existing.status}) for invitation ${invitationId}; skipping re-queue`,
      );
      return;
    }

    // --- 3. Create Notification + NotificationDelivery in a transaction ---
    // Notification.userId is nullable for invitation-sourced notifications (invitee may not be registered).
    const { notification, delivery } = await this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          agencyId: invitation.agencyId,
          userId: null,               // Invited user may not have a registered account yet
          title: `You're invited to join ${invitation.agency.name}`,
          body: `Accept your invitation to become a member of ${invitation.agency.name} on AGENCIE.`,
          eventType: DomainEvents.MemberInvited,
        },
      });

      const delivery = await tx.notificationDelivery.create({
        data: {
          agencyId: invitation.agencyId,
          notificationId: notification.id,
          invitationId: invitation.id,
          channel: "EMAIL",
          status: "QUEUED",
        },
      });

      return { notification, delivery };
    });

    this.logger.log(
      `Created NotificationDelivery ${delivery.id} for invitation ${invitationId}; publishing NotificationQueued`,
    );

    // --- 4. Publish NotificationQueued with REFERENCE-ONLY payload ---
    // This routes to notification_module.email_delivery where processDelivery() sends the actual email.
    await this.eventBus.publish(DomainEvents.NotificationQueued, {
      agencyId: invitation.agencyId,
      actorId: null,
      aggregateId: delivery.id,
      aggregateType: "NotificationDelivery",
      payload: { deliveryId: delivery.id },
    });

    this.logger.log(
      `NotificationQueued published for deliveryId: ${delivery.id} (invitation: ${invitationId})`,
    );
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
