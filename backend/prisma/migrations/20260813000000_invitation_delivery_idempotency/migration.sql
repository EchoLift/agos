-- Make notifications.userId nullable.
-- Invitation-sourced notifications have no registered userId at send time.
ALTER TABLE "notifications" ALTER COLUMN "userId" DROP NOT NULL;

-- Add invitationId to notification_deliveries.
-- This column is set for invitation email deliveries and used for idempotency.
ALTER TABLE "notification_deliveries" ADD COLUMN "invitationId" TEXT;

-- Unique constraint: only one EMAIL delivery per invitation (prevents duplicate sends on MemberInvited redelivery).
-- The constraint allows multiple NULL invitationId rows (normal operational deliveries).
CREATE UNIQUE INDEX "notification_deliveries_invitationId_channel_key"
  ON "notification_deliveries"("invitationId", "channel")
  WHERE "invitationId" IS NOT NULL;
