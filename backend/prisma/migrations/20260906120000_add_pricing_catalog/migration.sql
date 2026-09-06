-- Database-backed commercial catalog. Existing billing rows remain intact.
CREATE TYPE "PricingDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE "pricing_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "priceAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "teamLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_plans_duration_positive" CHECK ("durationMonths" > 0),
    CONSTRAINT "pricing_plans_price_positive" CHECK ("priceAmountMinor" > 0),
    CONSTRAINT "pricing_plans_currency_inr" CHECK ("currency" = 'INR'),
    CONSTRAINT "pricing_plans_team_limit_positive" CHECK ("teamLimit" IS NULL OR "teamLimit" > 0)
);

CREATE UNIQUE INDEX "pricing_plans_code_key" ON "pricing_plans"("code");
CREATE INDEX "pricing_plans_isActive_displayOrder_idx" ON "pricing_plans"("isActive", "displayOrder");

CREATE TABLE "pricing_discounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PricingDiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "maxRedemptions" INTEGER,
    "maxRedemptionsPerAgency" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_discounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_discounts_value_positive" CHECK ("value" > 0),
    CONSTRAINT "pricing_discounts_percentage_valid" CHECK ("type" <> 'PERCENTAGE' OR "value" <= 10000),
    CONSTRAINT "pricing_discounts_schedule_valid" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt"),
    CONSTRAINT "pricing_discounts_global_limit_positive" CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" > 0),
    CONSTRAINT "pricing_discounts_agency_limit_positive" CHECK ("maxRedemptionsPerAgency" IS NULL OR "maxRedemptionsPerAgency" > 0)
);

CREATE INDEX "pricing_discounts_isActive_startsAt_endsAt_idx" ON "pricing_discounts"("isActive", "startsAt", "endsAt");

CREATE TABLE "pricing_discount_plans" (
    "discountId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    CONSTRAINT "pricing_discount_plans_pkey" PRIMARY KEY ("discountId", "planId")
);
CREATE INDEX "pricing_discount_plans_planId_idx" ON "pricing_discount_plans"("planId");

ALTER TABLE "agency_payment_orders"
    ALTER COLUMN "period" DROP NOT NULL,
    ADD COLUMN "pricingPlanId" TEXT,
    ADD COLUMN "planCodeSnapshot" TEXT,
    ADD COLUMN "planNameSnapshot" TEXT,
    ADD COLUMN "baseAmountMinor" INTEGER,
    ADD COLUMN "discountAmountMinor" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "discountId" TEXT,
    ADD COLUMN "discountNameSnapshot" TEXT;

ALTER TABLE "agency_payment_orders"
    ADD CONSTRAINT "agency_payment_orders_amount_nonnegative" CHECK ("amountMinor" >= 0),
    ADD CONSTRAINT "agency_payment_orders_base_amount_positive" CHECK ("baseAmountMinor" IS NULL OR "baseAmountMinor" > 0),
    ADD CONSTRAINT "agency_payment_orders_discount_amount_nonnegative" CHECK ("discountAmountMinor" >= 0),
    ADD CONSTRAINT "agency_payment_orders_discount_not_over_base" CHECK ("baseAmountMinor" IS NULL OR "discountAmountMinor" <= "baseAmountMinor");

ALTER TABLE "agency_subscriptions" ADD COLUMN "teamLimit" INTEGER,
    ADD COLUMN "teamLimitSnapshotSet" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "agency_subscriptions"
    ADD CONSTRAINT "agency_subscriptions_team_limit_positive" CHECK ("teamLimit" IS NULL OR "teamLimit" > 0);

CREATE TABLE "pricing_discount_redemptions" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_discount_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pricing_discount_redemptions_paymentOrderId_key" ON "pricing_discount_redemptions"("paymentOrderId");
CREATE INDEX "pricing_discount_redemptions_discountId_redeemedAt_idx" ON "pricing_discount_redemptions"("discountId", "redeemedAt");
CREATE INDEX "pricing_discount_redemptions_discountId_agencyId_redeemedAt_idx" ON "pricing_discount_redemptions"("discountId", "agencyId", "redeemedAt");
CREATE INDEX "agency_payment_orders_pricingPlanId_createdAt_idx" ON "agency_payment_orders"("pricingPlanId", "createdAt");
CREATE INDEX "agency_payment_orders_discountId_status_idx" ON "agency_payment_orders"("discountId", "status");

ALTER TABLE "audit_events" ALTER COLUMN "agencyId" DROP NOT NULL;

ALTER TABLE "pricing_discount_plans" ADD CONSTRAINT "pricing_discount_plans_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "pricing_discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pricing_discount_plans" ADD CONSTRAINT "pricing_discount_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "pricing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_payment_orders" ADD CONSTRAINT "agency_payment_orders_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "pricing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_payment_orders" ADD CONSTRAINT "agency_payment_orders_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "pricing_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pricing_discount_redemptions" ADD CONSTRAINT "pricing_discount_redemptions_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "pricing_discounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pricing_discount_redemptions" ADD CONSTRAINT "pricing_discount_redemptions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pricing_discount_redemptions" ADD CONSTRAINT "pricing_discount_redemptions_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "agency_payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "pricing_plans" ("id", "code", "name", "durationMonths", "priceAmountMinor", "currency", "teamLimit", "isActive", "displayOrder") VALUES
('00000000-0000-4000-8000-000000000003', 'THREE_MONTHS', '3 Months', 3, 349900, 'INR', 50, true, 10),
('00000000-0000-4000-8000-000000000006', 'SIX_MONTHS', '6 Months', 6, 599900, 'INR', 120, true, 20),
('00000000-0000-4000-8000-000000000012', 'TWELVE_MONTHS', '12 Months', 12, 999900, 'INR', NULL, true, 30)
ON CONFLICT ("code") DO NOTHING;

UPDATE "agency_payment_orders" o SET
    "pricingPlanId" = p."id",
    "planCodeSnapshot" = o."period"::text,
    "planNameSnapshot" = p."name",
    "baseAmountMinor" = o."amountMinor"
FROM "pricing_plans" p
WHERE o."period"::text = p."code" AND o."pricingPlanId" IS NULL;

UPDATE "agency_subscriptions" SET "teamLimit" = 20, "teamLimitSnapshotSet" = true WHERE "status" = 'TRIAL';
UPDATE "agency_subscriptions" s SET "teamLimit" = latest."teamLimitSnapshot", "teamLimitSnapshotSet" = true
FROM (
    SELECT DISTINCT ON ("agencyId") "agencyId", "teamLimitSnapshot"
    FROM "agency_payment_orders"
    WHERE "status" = 'PAID'
    ORDER BY "agencyId", "paidAt" DESC NULLS LAST, "createdAt" DESC
) latest
WHERE s."agencyId" = latest."agencyId" AND s."teamLimit" IS NULL;
