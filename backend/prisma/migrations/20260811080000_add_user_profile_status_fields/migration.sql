-- Keep the production database aligned with the current User profile model.
-- These fields are optional, so the migration is safe for existing OAuth users.

DO $$
BEGIN
  CREATE TYPE "PresenceStatus" AS ENUM ('AVAILABLE', 'BUSY', 'DO_NOT_DISTURB', 'AWAY', 'OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkLocation" AS ENUM ('WFO', 'WFH', 'REMOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobileNumberEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobileNumberHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "presenceStatus" "PresenceStatus";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workLocation" "WorkLocation";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "statusMessage" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "statusExpiresAt" TIMESTAMP(3);
