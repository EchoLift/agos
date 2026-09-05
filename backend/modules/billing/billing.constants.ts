import { BillingPeriod } from "@prisma/client";

export const BILLING_PERIODS = {
  [BillingPeriod.THREE_MONTHS]: {
    months: 3,
    amountMinor: 349900,
    teamLimit: 50,
  },
  [BillingPeriod.SIX_MONTHS]: {
    months: 6,
    amountMinor: 599900,
    teamLimit: 120,
  },
  [BillingPeriod.TWELVE_MONTHS]: {
    months: 12,
    amountMinor: 999900,
    teamLimit: null,
  },
} as const;
export const TRIAL_TEAM_LIMIT = 20;
export const BILLING_ROLE_KEYS = new Set(["OWNER", "FINANCE"]);
