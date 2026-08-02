import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { AuthUserRepository } from "../repositories/auth-user.repository";
import { CryptoService } from "./crypto.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { SessionService } from "./session.service";
import { RequestContextService } from "@packages/request-context/request-context.service";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser, Session } from "@prisma/client";
import { UserService } from "@modules/user/services/user.service";
import { InvitationClaimService } from "./invitation-claim.service";

describe("AuthService Integration", () => {
  let authService: AuthService;
  let sessionService: SessionService;
  let tokenService: TokenService;
  let repository: jest.Mocked<AuthUserRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findByEmailHash: jest.fn(),
      findByProviderIdentity: jest.fn(),
      findByProviderIdentityOrEmail: jest.fn(),
      linkProviderIdentity: jest.fn(),
      createUser: jest.fn(),
      createSession: jest.fn(),
      findSession: jest.fn(),
      rotateSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeFamily: jest.fn(),
    };

    const mockRequestContext = {
      get: jest
        .fn()
        .mockReturnValue({
          correlationId: "test-corr-id",
          requestId: "test-req-id",
          ip: "127.0.0.1",
        }),
    };
    const mockUserService = {
      provisionUser: jest
        .fn()
        .mockResolvedValue({
          id: "profile-user-id",
          authUserId: "auth-user-id",
        }),
    };
    const mockInvitationClaimService = {
      claimPendingInvitationsForUser: jest
        .fn()
        .mockResolvedValue({ claimed: 0, membershipIds: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SessionService,
        TokenService,
        CryptoService,
        PasswordService,
        { provide: AuthUserRepository, useValue: mockRepository },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: UserService, useValue: mockUserService },
        {
          provide: InvitationClaimService,
          useValue: mockInvitationClaimService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === "JWT_ACCESS_SECRET") return "test-jwt";
              if (key === "ENCRYPTION_SECRET")
                return "test-encryption-secret-1234567890";
              if (key === "FIELD_LOOKUP_SECRET") return "test-lookup-secret";
              if (key === "GOOGLE_CLIENT_ID") return "google-client-id";
              return null;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    sessionService = module.get<SessionService>(SessionService);
    tokenService = module.get<TokenService>(TokenService);
    repository = module.get(AuthUserRepository) as any;
  });

  it("should detect token reuse and revoke the family", async () => {
    // Generate a token simulating the one the user provides
    const providedRefreshToken = tokenService.generateRefreshToken();
    const providedHash = tokenService.hashRefreshToken(providedRefreshToken);

    // Simulate finding a session that is already REVOKED
    const mockSession: Partial<Session> = {
      id: "session-id",
      authUserId: "user-id",
      refreshTokenHash: providedHash,
      refreshTokenFamilyId: "family-id",
      status: "REVOKED", // Key part: it's not ACTIVE
      expiresAt: new Date(Date.now() + 100000),
    };

    repository.findSession.mockResolvedValue(mockSession as Session);
    repository.revokeFamily.mockResolvedValue();

    await expect(authService.refresh(providedRefreshToken)).rejects.toThrow(
      UnauthorizedException,
    );

    // Verify it called revokeFamily to kill the whole session tree
    expect(repository.revokeFamily).toHaveBeenCalledWith(
      "family-id",
      expect.objectContaining({
        reason: "Token Reuse Detected or Expired Token",
      }),
      "test-corr-id",
    );
  });

  it("should reject manual login for Google-only accounts", async () => {
    repository.findByEmailHash.mockResolvedValue({
      id: "google-user-id",
      emailHash: "hash",
      emailEncrypted: "encrypted",
      passwordHash: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      version: 1,
    } as AuthUser);

    await expect(
      authService.login({
        email: "user@example.com",
        password: "password123456",
      }),
    ).rejects.toThrow("Please sign in with Google");
  });

  it("should create a Google-only user and establish a normal session", async () => {
    mockGooglePayload({
      email: "new@example.com",
      sub: "google-sub-new",
      email_verified: true,
    });

    const user = authUser({ id: "new-auth-user-id", passwordHash: null });
    repository.findByProviderIdentityOrEmail.mockResolvedValue({
      user: null,
      matchedProvider: false,
    });
    repository.createUser.mockResolvedValue(user);
    repository.createSession.mockResolvedValue(
      session({ authUserId: user.id }),
    );

    const result = await authService.googleLogin("google-id-token");

    expect(repository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        identities: expect.objectContaining({
          create: expect.objectContaining({
            provider: "GOOGLE",
            providerUserId: "google-sub-new",
          }),
        }),
      }),
      expect.objectContaining({
        provider: "google",
      }),
      "test-corr-id",
    );
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it("should link Google ID to an existing manual account with same verified email", async () => {
    mockGooglePayload({
      email: "existing@example.com",
      sub: "google-sub-existing",
      email_verified: true,
    });

    const existingUser = authUser({
      id: "existing-auth-user-id",
      passwordHash: "hash",
    });
    const linkedUser = authUser({ id: existingUser.id, passwordHash: "hash" });

    repository.findByProviderIdentityOrEmail.mockResolvedValue({
      user: existingUser,
      matchedProvider: false,
    });
    repository.linkProviderIdentity.mockResolvedValue(linkedUser);
    repository.createSession.mockResolvedValue(
      session({ authUserId: linkedUser.id }),
    );

    await authService.googleLogin("google-id-token");

    expect(repository.linkProviderIdentity).toHaveBeenCalledWith(
      existingUser.id,
      "GOOGLE",
      "google-sub-existing",
      expect.any(String),
      expect.objectContaining({
        eventType: "AuthProviderLinked",
        provider: "google",
      }),
      "test-corr-id",
    );
  });

  it("claims pending invitations after successful manual login", async () => {
    const invitationClaimService = (authService as any)
      .invitationClaimService as jest.Mocked<InvitationClaimService>;
    const user = authUser({
      id: "manual-auth-user-id",
      passwordHash: await new PasswordService().hash("password123456"),
    });

    repository.findByEmailHash.mockResolvedValue(user);
    repository.createSession.mockResolvedValue(
      session({ authUserId: user.id }),
    );

    await authService.login({
      email: " USER@Example.COM ",
      password: "password123456",
    });

    expect(
      invitationClaimService.claimPendingInvitationsForUser,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: user.id,
        userId: "profile-user-id",
        emailHash: expect.any(String),
      }),
    );
  });

  it("should reject Google tokens without a verified email", async () => {
    mockGooglePayload({
      email: "unverified@example.com",
      sub: "google-sub-unverified",
      email_verified: false,
    });

    await expect(authService.googleLogin("google-id-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  function mockGooglePayload(payload: {
    email: string;
    sub: string;
    email_verified: boolean;
  }) {
    (authService as any).googleClient = {
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => payload,
      }),
    };
  }

  function authUser(overrides: Partial<AuthUser>): AuthUser {
    return {
      id: "auth-user-id",
      emailHash: "email-hash",
      emailEncrypted: "encrypted-email",
      passwordHash: "password-hash",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      version: 1,
      ...overrides,
    } as AuthUser;
  }

  function session(overrides: Partial<Session>): Session {
    return {
      id: "session-id",
      authUserId: "auth-user-id",
      refreshTokenHash: "refresh-hash",
      refreshTokenFamilyId: "refresh-family-id",
      deviceLabel: null,
      userAgent: null,
      ipAddressEncrypted: null,
      status: "ACTIVE",
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      createdAt: new Date(),
      ...overrides,
    } as Session;
  }
});
