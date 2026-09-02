-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "agency_subscriptions" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "plan" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "agency_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_subscriptions_agencyId_key" ON "agency_subscriptions"("agencyId");
CREATE INDEX "agency_subscriptions_status_idx" ON "agency_subscriptions"("status");

ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_agencyId_fkey"
FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
