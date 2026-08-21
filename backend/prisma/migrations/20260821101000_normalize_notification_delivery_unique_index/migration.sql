-- Normalize the invitation delivery idempotency index to match Prisma's
-- @@unique([invitationId, channel]) declaration.
--
-- PostgreSQL unique indexes already allow multiple NULL invitationId values,
-- so the previous partial WHERE clause is unnecessary.

DROP INDEX IF EXISTS "notification_deliveries_invitationId_channel_key";

CREATE UNIQUE INDEX "notification_deliveries_invitationId_channel_key"
ON "notification_deliveries"("invitationId", "channel");
