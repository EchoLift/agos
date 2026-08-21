import { buildDeepLink } from "./email-templates";

describe("buildDeepLink", () => {
  const originalRootDomain = process.env.ROOT_DOMAIN;

  afterEach(() => {
    if (originalRootDomain === undefined) {
      delete process.env.ROOT_DOMAIN;
    } else {
      process.env.ROOT_DOMAIN = originalRootDomain;
    }
  });

  it("builds tenant subdomain links for production workspace routes", () => {
    process.env.ROOT_DOMAIN = "agencie.in";

    expect(
      buildDeepLink("https://app.agencie.in", "/files", "social-expert"),
    ).toBe("https://social-expert.agencie.in/files");
  });

  it("keeps path-based workspace routes for local development", () => {
    expect(
      buildDeepLink("http://localhost:3000", "/files", "social-expert"),
    ).toBe("http://localhost:3000/social-expert/files");
  });
});
