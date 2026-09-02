import { ForbiddenException } from "@nestjs/common";
import { PlatformAdminGuard } from "./platform-admin.guard";

describe("PlatformAdminGuard", () => {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: "user-1" } }),
    }),
  } as never;
  it("denies an agency owner who is not a platform admin", async () => {
    const guard = new PlatformAdminGuard({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ platformRole: "USER", deletedAt: null }),
      },
    } as never);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("allows a platform admin", async () => {
    const guard = new PlatformAdminGuard({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ platformRole: "ADMIN", deletedAt: null }),
      },
    } as never);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
