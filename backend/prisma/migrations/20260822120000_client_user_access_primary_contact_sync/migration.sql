ALTER TABLE "clients" ADD COLUMN "primaryContactUserId" TEXT;

CREATE TABLE "client_user_accesses" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_user_accesses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invitation_client_accesses" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_client_accesses_pkey" PRIMARY KEY ("id")
);

INSERT INTO "client_user_accesses" ("id", "agencyId", "clientId", "userId", "createdAt", "updatedAt")
SELECT
    'legacy_membership_' || md5("id" || ':' || "clientId" || ':' || "userId"),
    "agencyId",
    "clientId",
    "userId",
    COALESCE("joinedAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "memberships"
WHERE "clientId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "invitation_client_accesses" ("id", "agencyId", "invitationId", "clientId", "createdAt")
SELECT
    'legacy_invitation_' || md5("id" || ':' || "clientId"),
    "agencyId",
    "id",
    "clientId",
    COALESCE("createdAt", CURRENT_TIMESTAMP)
FROM "invitations"
WHERE "clientId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "client_user_accesses_agencyId_clientId_userId_key" ON "client_user_accesses"("agencyId", "clientId", "userId");
CREATE INDEX "client_user_accesses_agencyId_userId_idx" ON "client_user_accesses"("agencyId", "userId");
CREATE INDEX "client_user_accesses_agencyId_clientId_idx" ON "client_user_accesses"("agencyId", "clientId");
CREATE UNIQUE INDEX "invitation_client_accesses_invitationId_clientId_key" ON "invitation_client_accesses"("invitationId", "clientId");
CREATE INDEX "invitation_client_accesses_agencyId_clientId_idx" ON "invitation_client_accesses"("agencyId", "clientId");
CREATE INDEX "clients_agencyId_primaryContactUserId_idx" ON "clients"("agencyId", "primaryContactUserId");

ALTER TABLE "clients" ADD CONSTRAINT "clients_primaryContactUserId_fkey" FOREIGN KEY ("primaryContactUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_user_accesses" ADD CONSTRAINT "client_user_accesses_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_user_accesses" ADD CONSTRAINT "client_user_accesses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_user_accesses" ADD CONSTRAINT "client_user_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitation_client_accesses" ADD CONSTRAINT "invitation_client_accesses_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitation_client_accesses" ADD CONSTRAINT "invitation_client_accesses_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitation_client_accesses" ADD CONSTRAINT "invitation_client_accesses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
