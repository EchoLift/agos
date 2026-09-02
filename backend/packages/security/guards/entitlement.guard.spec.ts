import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EntitlementGuard } from "./entitlement.guard";

describe("EntitlementGuard", () => {
  const context = (user: object) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as never;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  it("does not let membership-derived tenant context bypass a missing entitlement", async () => {
    const guard = new EntitlementGuard(reflector, {
      checkAgencyAccess: jest.fn().mockResolvedValue({
        allowed: false,
        status: null,
        plan: null,
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        reason: "NO_ENTITLEMENT",
      }),
    } as never);
    await expect(
      guard.canActivate(
        context({
          userId: "user-1",
          membershipId: "member-1",
          agencyId: "agency-1",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns the structured blocked response for a suspended agency", async () => {
    const guard = new EntitlementGuard(reflector, {
      checkAgencyAccess: jest.fn().mockResolvedValue({
        allowed: false,
        status: "SUSPENDED",
        plan: "PILOT",
        trialEndsAt: null,
        startsAt: null,
        endsAt: null,
        reason: "SUSPENDED",
      }),
    } as never);
    try {
      await guard.canActivate(
        context({ userId: "user-1", agencyId: "agency-1" }),
      );
      throw new Error("expected denial");
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: "ENTITLEMENT_001",
        entitlement: { status: "SUSPENDED", reason: "SUSPENDED" },
      });
    }
  });
});
