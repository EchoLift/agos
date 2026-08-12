-- AlterTable: Add emailEncrypted as nullable for legacy compatibility
ALTER TABLE "invitations" ADD COLUMN "emailEncrypted" TEXT;
