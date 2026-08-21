-- CreateEnum
CREATE TYPE "AnalyticsFileCategory" AS ENUM ('IMAGE', 'VIDEO', 'PDF', 'SPREADSHEET', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "client_analytics_assets" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "category" "AnalyticsFileCategory" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "client_analytics_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_analytics_assets_objectKey_key" ON "client_analytics_assets"("objectKey");

-- CreateIndex
CREATE INDEX "client_analytics_assets_agencyId_clientId_year_month_delete_idx" ON "client_analytics_assets"("agencyId", "clientId", "year", "month", "deletedAt");

-- CreateIndex
CREATE INDEX "client_analytics_assets_agencyId_clientId_category_deletedA_idx" ON "client_analytics_assets"("agencyId", "clientId", "category", "deletedAt");

-- CreateIndex
CREATE INDEX "client_analytics_assets_clientId_createdAt_idx" ON "client_analytics_assets"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "client_analytics_assets" ADD CONSTRAINT "client_analytics_assets_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_analytics_assets" ADD CONSTRAINT "client_analytics_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_analytics_assets" ADD CONSTRAINT "client_analytics_assets_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
