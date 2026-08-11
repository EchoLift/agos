import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { AuthUserRepository } from "../repositories/auth-user.repository";
import { CryptoService } from "./crypto.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { SessionService } from "./session.service";
import { RegisterDto } from "../dto/register.dto";
import { LoginDto } from "../dto/login.dto";
import { RequestContextService } from "@packages/request-context/request-context.service";
import { ConfigService } from "@nestjs/config";
import { AuthProvider, Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { UserService } from "@modules/user/services/user.service";
import { InvitationClaimService } from "./invitation-claim.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthUserRepository,
    private readonly crypto: CryptoService,
    private readonly password: PasswordService,
    private readonly token: TokenService,
    private readonly session: SessionService,
    private readonly requestContext: RequestContextService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly invitationClaimService: InvitationClaimService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>("GOOGLE_CLIENT_ID"),
    );
  }

  private readonly googleClient: OAuth2Client;

  async register(dto: RegisterDto): Promise<void> {
    const email = this.crypto.normalizeEmail(dto.email);
    const emailHash = this.crypto.hashEmailLookup(email);
    const existing = await this.repository.findByEmailHash(emailHash);

    if (existing) {
      // In a strict environment we might return a success message here to prevent enumeration
      throw new BadRequestException("Email already in use");
    }

    const emailEncrypted = this.crypto.encrypt(email);
    const passwordHash = await this.password.hash(dto.password);

    const context = this.requestContext.get();

    await this.repository.createUser(
      {
        emailHash,
        emailEncrypted,
        passwordHash,
      },
      {
        eventType: "UserRegistered",
        emailHash,
        occurredAt: new Date().toISOString(),
        requestId: context?.requestId,
        correlationId: context?.correlationId,
      },
      context?.correlationId,
    );
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const email = this.crypto.normalizeEmail(dto.email);
    const emailHash = this.crypto.hashEmailLookup(email);
    const user = await this.repository.findByEmailHash(emailHash);

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException("Please sign in with Google");
    }

    const valid = await this.password.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.claimPendingInvitations(user.id, email, emailHash);

    const refreshToken = this.token.generateRefreshToken();
    const session = await this.session.createSession(user.id, refreshToken);
    const accessToken = this.token.signAccessToken(user.id, session.id);

    return { accessToken, refreshToken };
  }

  async googleLogin(
    idToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: {
      email?: string;
      sub?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    } | null = null;

    if (this.isDevGoogleTokenAllowed(idToken)) {
      const email = idToken.split(":")[1];
      payload = {
        email,
        sub: `dev-${email}`,
        email_verified: true,
        name: email.split("@")[0],
      };
    } else {
      let ticket;
      try {
        ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: this.config.get<string>("GOOGLE_CLIENT_ID"),
        });
      } catch (e) {
        throw new UnauthorizedException("Invalid Google token");
      }

      payload = ticket.getPayload() ?? null;
    }

    if (
      !payload ||
      !payload.email ||
      !payload.sub ||
      payload.email_verified !== true
    ) {
      throw new UnauthorizedException("Invalid Google token payload");
    }

    const providerUserId = payload.sub;
    const email = this.crypto.normalizeEmail(payload.email);
    const emailHash = this.crypto.hashEmailLookup(email);
    const profile = {
      name: payload.name ?? email.split("@")[0],
      avatarUrl: payload.picture ?? null,
    };

    const identityLookup = await this.repository.findByProviderIdentityOrEmail(
      AuthProvider.GOOGLE,
      providerUserId,
      emailHash,
    );
    let user = identityLookup.user;

    if (!user) {
      user = await this.createGoogleUserOrRecover(
        providerUserId,
        email,
        emailHash,
      );
    } else if (!identityLookup.matchedProvider) {
      user = await this.linkGoogleProviderOrRecover(
        user.id,
        providerUserId,
        emailHash,
      );
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account disabled");
    }

    // Synchronously provision the User profile if it doesn't exist yet.
    // This avoids a race condition where the frontend calls createAgency
    // before the async RabbitMQ consumer has had time to create the User row.
    const profileUser = await this.userService.provisionUser(user.id, profile);
    await this.claimPendingInvitations(
      user.id,
      email,
      emailHash,
      profileUser.id,
    );

    const refreshToken = this.token.generateRefreshToken();
    const session = await this.session.createSession(user.id, refreshToken);
    const accessToken = this.token.signAccessToken(user.id, session.id);

    return { accessToken, refreshToken };
  }

  private isDevGoogleTokenAllowed(idToken: string): boolean {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID") ?? "";
    const isDev = this.config.get<string>("NODE_ENV") !== "production";
    const isPlaceholderClient = !clientId || clientId.includes("replace");
    return (
      isDev && isPlaceholderClient && idToken.startsWith("dev-google-token:")
    );
  }

  private async createGoogleUserOrRecover(
    providerUserId: string,
    email: string,
    emailHash: string,
  ) {
    const emailEncrypted = this.crypto.encrypt(email);
    const context = this.requestContext.get();

    try {
      return await this.repository.createUser(
        {
          emailHash,
          emailEncrypted,
          identities: {
            create: {
              provider: AuthProvider.GOOGLE,
              providerUserId,
              emailHash,
            },
          },
        },
        {
          eventType: "UserRegistered",
          emailHash,
          provider: "google",
          occurredAt: new Date().toISOString(),
          requestId: context?.requestId,
          correlationId: context?.correlationId,
        },
        context?.correlationId,
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const retryLookup = await this.repository.findByProviderIdentityOrEmail(
          AuthProvider.GOOGLE,
          providerUserId,
          emailHash,
        );
        if (retryLookup.user) {
          return retryLookup.user;
        }
      }
      throw error;
    }
  }

  private async linkGoogleProviderOrRecover(
    authUserId: string,
    providerUserId: string,
    emailHash: string,
  ) {
    const context = this.requestContext.get();

    try {
      return await this.repository.linkProviderIdentity(
        authUserId,
        AuthProvider.GOOGLE,
        providerUserId,
        emailHash,
        {
          eventType: "AuthProviderLinked",
          authUserId,
          emailHash,
          provider: "google",
          occurredAt: new Date().toISOString(),
          requestId: context?.requestId,
          correlationId: context?.correlationId,
        },
        context?.correlationId,
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const retryLookup = await this.repository.findByProviderIdentityOrEmail(
          AuthProvider.GOOGLE,
          providerUserId,
          emailHash,
        );
        if (retryLookup.user) {
          return retryLookup.user;
        }
      }
      throw error;
    }
  }

  private async claimPendingInvitations(
    authUserId: string,
    email: string,
    emailHash: string,
    userId?: string,
  ) {
    const context = this.requestContext.get();
    const profileUser = userId
      ? { id: userId }
      : await this.userService.provisionUser(authUserId, {
          name: email.split("@")[0],
          avatarUrl: null,
        });

    await this.invitationClaimService.claimPendingInvitationsForUser({
      authUserId,
      userId: profileUser.id,
      emailHash,
      requestId: context?.requestId,
      correlationId: context?.correlationId,
    });
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { session, newRefreshTokenStr } =
      await this.session.rotateSession(refreshToken);
    const accessToken = this.token.signAccessToken(
      session.authUserId,
      session.id,
    );

    return { accessToken, refreshToken: newRefreshTokenStr };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.session.revokeSession(refreshToken);
  }
}
