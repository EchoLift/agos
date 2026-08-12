import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { TenantGuard } from "./tenant.guard";

describe("Subdomain Security & Membership Authorization", () => {
  let guard: TenantGuard;
  let repo: any;
  let securityContextService: any;
  let requestContextService: any;
  let reflector: any;

  beforeEach(() => {
    repo = {
      findMembership: jest.fn(),
    };
    securityContextService = {
      resolveUserRolesAndPermissions: jest.fn().mockResolvedValue({
        roles: ["WRITER"],
        permissions: ["CONTENT_CREATE"],
      }),
      append: jest.fn(),
    };
    requestContextService = {
      get: jest.fn().mockReturnValue({ correlationId: "corr-123" }),
      append: jest.fn(),
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false), // not public
    };
    guard = new TenantGuard(
      reflector,
      repo,
      securityContextService,
      requestContextService,
    );
  });

  it("never trusts Host header alone and rejects request if user is not a member of X-Agency-Id", async () => {
    repo.findMembership.mockResolvedValue(null); // No membership in agency-1

    const req = {
      headers: {
        host: "socia-expert.client-agos.calcie.fun", // Attacker sends hostname matching target agency
        "x-agency-id": "agency-1",
      },
      user: {
        authUserId: "auth-attacker-123",
        userId: "user-attacker-123",
      },
    };

    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    // Must throw ForbiddenException because membership check in database returns null
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

    expect(repo.findMembership).toHaveBeenCalledWith("agency-1", "user-attacker-123");
  });

  it("allows access when user has valid ACTIVE membership regardless of Host header", async () => {
    repo.findMembership.mockResolvedValue({
      id: "mem-valid",
      agencyId: "agency-1",
      userId: "user-legit-123",
      status: "ACTIVE",
      role: { id: "role-1", displayName: "Writer", systemRole: { key: "WRITER" } },
      roles: [{ role: { id: "role-1", displayName: "Writer", systemRole: { key: "WRITER" } } }],
    });

    const req: any = {
      headers: {
        host: "any-subdomain.client-agos.calcie.fun",
        "x-agency-id": "agency-1",
      },
      user: {
        authUserId: "auth-legit-123",
        userId: "user-legit-123",
      },
    };

    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.user.agencyId).toBe("agency-1");
  });
});
