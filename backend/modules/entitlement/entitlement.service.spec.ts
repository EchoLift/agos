import { SubscriptionStatus } from "@prisma/client";
import { EntitlementService } from "./entitlement.service";

describe("EntitlementService", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  const service = new EntitlementService({} as never);
  const subscription = (
    status: SubscriptionStatus,
    dates: Record<string, Date | null> = {},
  ) => ({
    status,
    plan: "PILOT",
    trialEndsAt: null,
    startsAt: null,
    endsAt: null,
    ...dates,
  });

  it("allows ACTIVE without an expired end", () =>
    expect(
      service.evaluate(subscription(SubscriptionStatus.ACTIVE), now).allowed,
    ).toBe(true));
  it("allows a valid TRIAL", () =>
    expect(
      service.evaluate(
        subscription(SubscriptionStatus.TRIAL, {
          trialEndsAt: new Date("2026-09-03T00:00:00Z"),
        }),
        now,
      ).allowed,
    ).toBe(true));
  it("denies an expired TRIAL", () =>
    expect(
      service.evaluate(
        subscription(SubscriptionStatus.TRIAL, {
          trialEndsAt: new Date("2026-09-01T00:00:00Z"),
        }),
        now,
      ).reason,
    ).toBe("TRIAL_EXPIRED"));
  it("denies a trial exactly at its boundary", () =>
    expect(
      service.evaluate(
        subscription(SubscriptionStatus.TRIAL, { trialEndsAt: now }),
        now,
      ).allowed,
    ).toBe(false));
  it.each([
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.PAST_DUE,
  ])("denies %s", (status) =>
    expect(service.evaluate(subscription(status), now).allowed).toBe(false),
  );
  it("denies a missing subscription", () =>
    expect(service.evaluate(null, now)).toMatchObject({
      allowed: false,
      reason: "NO_ENTITLEMENT",
    }));
});
