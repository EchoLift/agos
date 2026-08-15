-- CreateEnum
CREATE TYPE "GoogleCalendarSourceType" AS ENUM ('WORK_ORDER');

-- CreateTable
CREATE TABLE "google_calendar_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccountEmail" TEXT,
    "googleCalendarId" TEXT,
    "encryptedRefreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "sourceType" "GoogleCalendarSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUpdatedAt" TIMESTAMP(3),
    "sourceHash" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "google_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_connections_userId_key" ON "google_calendar_connections"("userId");

-- CreateIndex
CREATE INDEX "google_calendar_connections_syncEnabled_idx" ON "google_calendar_connections"("syncEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_events_userId_sourceType_sourceId_key" ON "google_calendar_events"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_events_googleCalendarId_googleEventId_key" ON "google_calendar_events"("googleCalendarId", "googleEventId");

-- CreateIndex
CREATE INDEX "google_calendar_events_agencyId_idx" ON "google_calendar_events"("agencyId");

-- CreateIndex
CREATE INDEX "google_calendar_events_userId_sourceType_idx" ON "google_calendar_events"("userId", "sourceType");

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
