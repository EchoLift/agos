import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";

function makeGuard(
  user: Record<string, unknown> | null | undefined,
  requiredPermissions: string[] | undefined,
) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, "getAllAndOverride")
    .mockImplementation((key: unknown) => {
      if (key === PERMISSIONS_KEY as unknown) return requiredPermissions;
      return undefined;
    });
  const guard = new PermissionsGuard(reflector);
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard, ctx };
}

describe("PermissionsGuard", () => {
  afterEach(() => jest.restoreAllMocks());

  describe("no @RequirePermissions decorator (pass-through)", () => {
    it("allows any authenticated user when no permissions are required", () => {
      const { guard, ctx } = makeGuard(
        { role: "WRITER", roles: ["WRITER"], permissions: [] },
        undefined,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("allows OWNER when no permissions are required", () => {
      const { guard, ctx } = makeGuard(
        { role: "OWNER", roles: ["OWNER"], permissions: [] },
        undefined,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("OWNER bypass", () => {
    it("OWNER passes even without having any permissions in the list", () => {
      const { guard, ctx } = makeGuard(
        { role: "OWNER", roles: ["OWNER"], permissions: [] },
        ["TEAM_INVITE"],
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("OWNER bypass works via roles[] array (multi-role membership)", () => {
      const { guard, ctx } = makeGuard(
        { role: "MANAGER", roles: ["OWNER", "MANAGER"], permissions: [] },
        ["CLIENT_CREATE"],
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("MANAGER with seeded permissions", () => {
    const managerUser = {
      role: "MANAGER",
      roles: ["MANAGER"],
      permissions: [
        "TEAM_INVITE",
        "TEAM_REMOVE",
        "CLIENT_CREATE",
        "CLIENT_UPDATE",
        "CLIENT_ARCHIVE",
        "CAMPAIGN_CREATE",
        "CAMPAIGN_UPDATE",
        "CONTENT_CREATE",
        "CONTENT_ASSIGN",
        "PUBLISHING_CREATE",
        "PUBLISHING_UPDATE",
        "PUBLISHING_CANCEL",
        "PUBLISHING_MARK_PUBLISHED",
        "PUBLISHING_LINK_CONTENT",
        "WORKFLOW_MANAGE",
        "BILLING_MANAGE",
        "SETTINGS_MANAGE",
      ],
    };

    it.each([
      ["TEAM_INVITE"],
      ["CLIENT_CREATE"],
      ["CLIENT_UPDATE"],
      ["CLIENT_ARCHIVE"],
      ["CAMPAIGN_CREATE"],
      ["CAMPAIGN_UPDATE"],
      ["CONTENT_CREATE"],
      ["PUBLISHING_CREATE"],
      ["PUBLISHING_UPDATE"],
      ["PUBLISHING_CANCEL"],
      ["PUBLISHING_MARK_PUBLISHED"],
    ])("MANAGER passes for %s", (perm) => {
      const { guard, ctx } = makeGuard(managerUser, [perm]);
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("WRITER — no permissions seeded", () => {
    const writerUser = {
      role: "WRITER",
      roles: ["WRITER"],
      permissions: [],
    };

    it.each([
      // Security regression: @RequirePermissions now decorates each of these endpoints
      ["TEAM_INVITE"],               // POST /organizations/:id/invitations
      ["CLIENT_CREATE"],             // POST /clients
      ["CLIENT_UPDATE"],             // PATCH /clients/:id, POST /clients/:id/assign-manager
      ["CLIENT_ARCHIVE"],            // POST /clients/:id/archive|restore
      ["CAMPAIGN_CREATE"],           // POST /campaigns
      ["CAMPAIGN_UPDATE"],           // PATCH /campaigns/:id
      ["CONTENT_CREATE"],            // POST /content-assets, PATCH /content-assets/:id
      ["PUBLISHING_CREATE"],         // POST /campaigns/:id/publishing-schedules
      ["PUBLISHING_UPDATE"],         // PATCH /campaigns/:id/publishing-schedules/:id
      ["PUBLISHING_CANCEL"],         // POST .../cancel
      ["PUBLISHING_MARK_PUBLISHED"], // POST .../mark-published
    ])("WRITER is blocked (403) for %s", (perm) => {
      const { guard, ctx } = makeGuard(writerUser, [perm]);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe("unauthenticated request", () => {
    it("throws ForbiddenException when no user on request", () => {
      const { guard, ctx } = makeGuard(
        undefined as unknown as Record<string, unknown>,
        ["TEAM_INVITE"],
      );
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
