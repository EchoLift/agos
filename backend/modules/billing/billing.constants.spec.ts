import { BillingPeriod } from "@prisma/client";
import {
  BILLING_PERIODS,
  BILLING_ROLE_KEYS,
  TRIAL_TEAM_LIMIT,
} from "./billing.constants";
describe("billing launch policy", () => {
  it("keeps backend-authoritative price and capacity snapshots", () => {
    expect(BILLING_PERIODS[BillingPeriod.THREE_MONTHS]).toEqual({
      months: 3,
      amountMinor: 100,
      teamLimit: 50,
    });
    expect(BILLING_PERIODS[BillingPeriod.SIX_MONTHS].teamLimit).toBe(120);
    expect(BILLING_PERIODS[BillingPeriod.TWELVE_MONTHS].teamLimit).toBeNull();
    expect(TRIAL_TEAM_LIMIT).toBe(20);
  });
  it("allows only OWNER and FINANCE billing roles", () => {
    expect(BILLING_ROLE_KEYS.has("OWNER")).toBe(true);
    expect(BILLING_ROLE_KEYS.has("FINANCE")).toBe(true);
    expect(BILLING_ROLE_KEYS.has("MANAGER")).toBe(false);
    expect(BILLING_ROLE_KEYS.has("ADMIN")).toBe(false);
  });
});
