import { Test, TestingModule } from "@nestjs/testing";
import { TokenService } from "./token.service";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";

describe("TokenService", () => {
  let service: TokenService;
  const jwtSecret = "test-jwt-secret";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "JWT_SECRET") return jwtSecret;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it("should sign and verify access token", () => {
    const authUserId = "user-123";
    const sessionId = "session-123";

    const token = service.signAccessToken(authUserId, sessionId);
    expect(token).toBeDefined();

    const decoded = service.verifyAccessToken(token);
    expect(decoded.sub).toEqual(authUserId);
    expect(decoded.sid).toEqual(sessionId);
  });

  it("should generate a 256-bit random refresh token (64 hex chars)", () => {
    const token = service.generateRefreshToken();
    expect(token.length).toBe(64);
  });

  it("should hash a refresh token consistently", () => {
    const token = service.generateRefreshToken();
    const hash1 = service.hashRefreshToken(token);
    const hash2 = service.hashRefreshToken(token);

    expect(hash1).toEqual(hash2);
    expect(hash1.length).toBe(64);
  });
});
