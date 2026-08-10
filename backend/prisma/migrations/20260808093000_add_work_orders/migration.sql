-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('SCRIPT', 'EDIT', 'DESIGN', 'SHOOT', 'THUMBNAIL', 'CAPTION', 'RESEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'CHANGES_REQUESTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderSubmissionStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'CHANGES_REQUESTED', 'RECALLED');

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "workType" "WorkOrderType" NOT NULL DEFAULT 'OTHER',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assigneeMembershipId" TEXT NOT NULL,
    "reviewerMembershipId" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "estimatedHours" INTEGER,
    "rewardAmount" DECIMAL(10,2),
    "rewardCurrency" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_submissions" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT,
    "externalLink" TEXT,
    "status" "WorkOrderSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_orders_agencyId_assigneeMembershipId_dueAt_idx" ON "work_orders"("agencyId", "assigneeMembershipId", "dueAt");

-- CreateIndex
CREATE INDEX "work_orders_agencyId_reviewerMembershipId_dueAt_idx" ON "work_orders"("agencyId", "reviewerMembershipId", "dueAt");

-- CreateIndex
CREATE INDEX "work_orders_agencyId_clientId_idx" ON "work_orders"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "work_orders_agencyId_status_idx" ON "work_orders"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_submissions_workOrderId_version_key" ON "work_order_submissions"("workOrderId", "version");

-- CreateIndex
CREATE INDEX "work_order_submissions_agencyId_workOrderId_idx" ON "work_order_submissions"("agencyId", "workOrderId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_reviewerMembershipId_fkey" FOREIGN KEY ("reviewerMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_submissions" ADD CONSTRAINT "work_order_submissions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_submissions" ADD CONSTRAINT "work_order_submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
