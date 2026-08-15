import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CryptoService } from "@modules/auth/services/crypto.service";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth.service";

describe("GoogleCalendarOAuthService", () => {
  let service: GoogleCalendarOAuthService;

  beforeEach(() => {
    service = new GoogleCalendarOAuthService(
      {
        get: jest.fn((key: string) => {
          const values: Record<string, string> = {
            GOOGLE_CLIENT_ID: "google-client",
            GOOGLE_CLIENT_SECRET: "google-secret",
            GOOGLE_CALENDAR_REDIRECT_URI:
              "http://localhost:4000/api/v1/integrations/google-calendar/callback",
            GOOGLE_CALENDAR_OAUTH_STATE_SECRET: "state-secret",
            JWT_ACCESS_SECRET: "access-secret",
          };
          return values[key];
        }),
      } as unknown as ConfigService,
      {
        encrypt: jest.fn((value: string) => `encrypted:${value}`),
        decrypt: jest.fn((value: string) => value.replace("encrypted:", "")),
      } as unknown as CryptoService,
    );
  });

  it("validates signed OAuth state for the initiating user", () => {
    const authorizationUrl = service.buildAuthorizationUrl(
      "user-1",
      "socia-expert",
    );
    const state = new URL(authorizationUrl).searchParams.get("state");

    expect(state).toBeTruthy();
    expect(service.validateState(state ?? "")).toEqual(
      expect.objectContaining({
        userId: "user-1",
        agencySlug: "socia-expert",
      }),
    );
  });

  it("rejects tampered OAuth state", () => {
    const authorizationUrl = service.buildAuthorizationUrl("user-1");
    const state = new URL(authorizationUrl).searchParams.get("state") ?? "";

    expect(() => service.validateState(`${state.slice(0, -1)}x`)).toThrow(
      UnauthorizedException,
    );
  });
});
