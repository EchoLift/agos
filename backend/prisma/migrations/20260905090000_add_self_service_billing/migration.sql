CREATE TYPE "BillingPeriod" AS ENUM ('THREE_MONTHS', 'SIX_MONTHS', 'TWELVE_MONTHS');
CREATE TYPE "PaymentOrderStatus" AS ENUM ('CREATING', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');
ALTER TABLE "users" ADD COLUMN "trialAvailedAt" TIMESTAMP(3), ADD COLUMN "trialAgencyId" TEXT;
CREATE TABLE "agency_payment_orders" (
  "id" TEXT NOT NULL, "agencyId" TEXT NOT NULL, "payerUserId" TEXT NOT NULL, "payerMembershipId" TEXT NOT NULL,
  "period" "BillingPeriod" NOT NULL, "durationMonths" INTEGER NOT NULL, "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR', "teamLimitSnapshot" INTEGER, "entitlementStartsAt" TIMESTAMP(3),
  "entitlementEndsAt" TIMESTAMP(3), "cashfreeOrderId" TEXT NOT NULL, "cashfreeCfOrderId" TEXT,
  "cashfreePaymentId" TEXT, "paymentSessionId" TEXT, "status" "PaymentOrderStatus" NOT NULL DEFAULT 'CREATING',
  "providerFailureCode" TEXT, "providerFailureReason" TEXT, "paidAt" TIMESTAMP(3), "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agency_payment_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agency_payment_orders_cashfreeOrderId_key" ON "agency_payment_orders"("cashfreeOrderId");
CREATE UNIQUE INDEX "agency_payment_orders_cashfreePaymentId_key" ON "agency_payment_orders"("cashfreePaymentId");
CREATE INDEX "agency_payment_orders_agencyId_createdAt_idx" ON "agency_payment_orders"("agencyId", "createdAt");
CREATE INDEX "agency_payment_orders_payerUserId_createdAt_idx" ON "agency_payment_orders"("payerUserId", "createdAt");
CREATE INDEX "agency_payment_orders_status_idx" ON "agency_payment_orders"("status");
ALTER TABLE "agency_payment_orders" ADD CONSTRAINT "agency_payment_orders_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_payment_orders" ADD CONSTRAINT "agency_payment_orders_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
WITH created AS (
  SELECT u.id AS "userId", e."aggregateId" AS "agencyId", e."createdAt", ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY e."createdAt", e.id) AS rn
  FROM "outbox_events" e JOIN "auth_users" au ON au.id = e.payload->>'createdBy' JOIN "users" u ON u."authUserId" = au.id
  WHERE e."eventType" = 'AgencyCreated'
)
UPDATE "users" u SET "trialAvailedAt" = c."createdAt", "trialAgencyId" = c."agencyId" FROM created c WHERE c.rn = 1 AND u.id = c."userId" AND u."trialAvailedAt" IS NULL;
