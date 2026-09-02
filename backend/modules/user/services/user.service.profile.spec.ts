import { ConfigService } from "@nestjs/config";
import { UserService } from "./user.service";

describe("UserService profile response", () => {
  it("exposes the authenticated user's platform role without auth secrets", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          name: "Platform Admin",
          avatarUrl: null,
          mobileNumberEncrypted: null,
          timezone: null,
          language: null,
          jobTitle: null,
          bio: null,
          presenceStatus: null,
          workLocation: null,
          statusMessage: null,
          statusExpiresAt: null,
          platformRole: "ADMIN",
          updatedAt: new Date("2026-09-02T00:00:00.000Z"),
          authUser: { emailEncrypted: "encrypted-email" },
        }),
      },
    };
    const service = new UserService(
      {} as never,
      prisma as never,
      { get: jest.fn().mockReturnValue(null) } as unknown as ConfigService,
    );

    const profile = await service.getProfile("user-1");

    expect(profile.platformRole).toBe("ADMIN");
    expect(profile).not.toHaveProperty("authUser");
    expect(profile).not.toHaveProperty("passwordHash");
  });
});
