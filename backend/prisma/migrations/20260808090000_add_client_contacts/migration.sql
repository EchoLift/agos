-- CreateEnum
CREATE TYPE "ClientContactRole" AS ENUM ('PRIMARY', 'BILLING', 'TECHNICAL', 'CREATIVE_APPROVER', 'EXECUTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientContactStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "emailEncrypted" TEXT,
    "emailHash" TEXT,
    "phoneEncrypted" TEXT,
    "phoneHash" TEXT,
    "whatsappEncrypted" TEXT,
    "whatsappHash" TEXT,
    "role" "ClientContactRole" NOT NULL DEFAULT 'PRIMARY',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "preferredContactMethod" "ContactMethod",
    "status" "ClientContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contacts_agencyId_clientId_idx" ON "client_contacts"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "client_contacts_agencyId_emailHash_idx" ON "client_contacts"("agencyId", "emailHash");

-- CreateIndex
CREATE INDEX "client_contacts_userId_idx" ON "client_contacts"("userId");

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
