import { IS_PUBLIC_KEY } from "@packages/security/decorators/public.decorator";
import { AuthController } from "./auth.controller";

describe("AuthController access metadata", () => {
  it("keeps authentication, refresh and logout routes outside tenant entitlement enforcement", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController)).toBe(true);
  });
});
