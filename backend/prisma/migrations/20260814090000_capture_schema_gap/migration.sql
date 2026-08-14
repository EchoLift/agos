-- CreateEnum
CREATE TYPE "CampaignAssignmentRole" AS ENUM ('CAMPAIGN_MANAGER', 'RELATIONSHIP_MANAGER', 'WRITER', 'EDITOR', 'DESIGNER', 'DOP', 'SOCIAL_MEDIA_MANAGER', 'CLIENT_APPROVER', 'AGENCY_APPROVER');

-- CreateEnum
CREATE TYPE "PublishingPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'TWITTER', 'WEBSITE', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "PublishingStatus" AS ENUM ('PLANNED', 'READY', 'SCHEDULED', 'PUBLISHED', 'MISSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CampaignStatus" ADD VALUE 'PAUSED';
ALTER TYPE "CampaignStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
ALTER TYPE "ContentAssetStatus" ADD VALUE 'PUBLISHED';

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "kpis",
ADD COLUMN     "agencyApproverMembershipId" TEXT,
ADD COLUMN     "approvalSla" TEXT,
ADD COLUMN     "autoGenerateCalendar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blackoutDates" TEXT,
ADD COLUMN     "campaignCode" TEXT,
ADD COLUMN     "campaignType" TEXT,
ADD COLUMN     "clientApprover" TEXT,
ADD COLUMN     "cta" TEXT,
ADD COLUMN     "driveFolderUrl" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "keyMessage" TEXT,
ADD COLUMN     "launchDate" TIMESTAMP(3),
ADD COLUMN     "moodBoardUrl" TEXT,
ADD COLUMN     "platformMix" TEXT,
ADD COLUMN     "postingDays" TEXT,
ADD COLUMN     "postingWindows" TEXT,
ADD COLUMN     "primaryKpi" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "references" TEXT,
ADD COLUMN     "reviewFrequency" TEXT,
ADD COLUMN     "revisionLimit" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "useClientAudience" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workflowTemplate" TEXT,
ADD COLUMN     "workingDays" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "aiWritingInstructions" TEXT,
ADD COLUMN     "approvalSla" TEXT,
ADD COLUMN     "audienceAge" TEXT,
ADD COLUMN     "audienceGender" TEXT,
ADD COLUMN     "audienceIncome" TEXT,
ADD COLUMN     "audienceInterests" TEXT,
ADD COLUMN     "audienceLocations" TEXT,
ADD COLUMN     "audienceOccupation" TEXT,
ADD COLUMN     "audiencePainPoints" TEXT,
ADD COLUMN     "availableDays" TEXT,
ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "brandDictionary" TEXT,
ADD COLUMN     "brandPersonality" TEXT,
ADD COLUMN     "brandStory" TEXT,
ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "businessSize" TEXT,
ADD COLUMN     "buyingBehavior" TEXT,
ADD COLUMN     "contentGoals" TEXT,
ADD COLUMN     "contentTypes" TEXT,
ADD COLUMN     "deliverables" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "donts" TEXT,
ADD COLUMN     "dos" TEXT,
ADD COLUMN     "engagementModel" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "faqs" TEXT,
ADD COLUMN     "forbiddenWords" TEXT,
ADD COLUMN     "googleBusinessUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "mission" TEXT,
ADD COLUMN     "postingFrequency" TEXT,
ADD COLUMN     "preferredContactMethod" TEXT,
ADD COLUMN     "preferredCta" TEXT,
ADD COLUMN     "primaryContactDesignation" TEXT,
ADD COLUMN     "primaryContactEmail" TEXT,
ADD COLUMN     "primaryContactName" TEXT,
ADD COLUMN     "primaryContactPhone" TEXT,
ADD COLUMN     "primaryContactWhatsapp" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "productKnowledge" TEXT,
ADD COLUMN     "revisionLimit" TEXT,
ADD COLUMN     "secondaryAudience" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "twitterUrl" TEXT,
ADD COLUMN     "usp" TEXT,
ADD COLUMN     "vision" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsappBusinessNumber" TEXT,
ADD COLUMN     "workingHours" TEXT,
ADD COLUMN     "youtubeUrl" TEXT;

-- CreateTable
CREATE TABLE "campaign_team_assignments" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "assignmentRole" "CampaignAssignmentRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "campaign_team_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_deliverable_plans" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "frequency" TEXT,
    "preferredDays" TEXT,
    "preferredTime" TEXT,
    "platform" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_deliverable_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_schedules" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contentAssetId" TEXT,
    "platform" "PublishingPlatform" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PublishingStatus" NOT NULL DEFAULT 'PLANNED',
    "riskStatus" "ContentRisk" NOT NULL DEFAULT 'ON_TRACK',
    "timezone" TEXT NOT NULL,
    "caption" TEXT,
    "note" TEXT,
    "cancellationReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "publishing_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_team_assignments_agencyId_campaignId_idx" ON "campaign_team_assignments"("agencyId", "campaignId");

-- CreateIndex
CREATE INDEX "campaign_team_assignments_agencyId_membershipId_idx" ON "campaign_team_assignments"("agencyId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_team_assignments_campaignId_membershipId_assignmen_key" ON "campaign_team_assignments"("campaignId", "membershipId", "assignmentRole");

-- CreateIndex
CREATE INDEX "campaign_deliverable_plans_agencyId_campaignId_idx" ON "campaign_deliverable_plans"("agencyId", "campaignId");

-- CreateIndex
CREATE INDEX "publishing_schedules_agencyId_campaignId_scheduledAt_idx" ON "publishing_schedules"("agencyId", "campaignId", "scheduledAt");

-- CreateIndex
CREATE INDEX "publishing_schedules_agencyId_contentAssetId_idx" ON "publishing_schedules"("agencyId", "contentAssetId");

-- CreateIndex
CREATE INDEX "campaigns_agencyId_campaignCode_idx" ON "campaigns"("agencyId", "campaignCode");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_agencyApproverMembershipId_fkey" FOREIGN KEY ("agencyApproverMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_team_assignments" ADD CONSTRAINT "campaign_team_assignments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_team_assignments" ADD CONSTRAINT "campaign_team_assignments_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_deliverable_plans" ADD CONSTRAINT "campaign_deliverable_plans_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_schedules" ADD CONSTRAINT "publishing_schedules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_schedules" ADD CONSTRAINT "publishing_schedules_contentAssetId_fkey" FOREIGN KEY ("contentAssetId") REFERENCES "content_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

