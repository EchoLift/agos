ALTER TABLE "memberships" ADD COLUMN "clientId" TEXT;
ALTER TABLE "invitations" ADD COLUMN "clientId" TEXT;

CREATE INDEX "memberships_agencyId_clientId_idx" ON "memberships"("agencyId", "clientId");
CREATE INDEX "invitations_agencyId_clientId_idx" ON "invitations"("agencyId", "clientId");

ALTER TABLE "memberships"
ADD CONSTRAINT "memberships_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invitations"
ADD CONSTRAINT "invitations_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
