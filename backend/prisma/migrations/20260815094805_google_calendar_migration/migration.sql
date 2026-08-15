/*
  Warnings:

  - A unique constraint covering the columns `[invitationId,channel]` on the table `notification_deliveries` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_invitationId_channel_key" ON "notification_deliveries"("invitationId", "channel");
