import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthUserRepository } from "../repositories/auth-user.repository";
import { TokenService } from "./token.service";
import { randomUUID } from "crypto";
import { Session } from "@prisma/client";
import { RequestContextService } from "@packages/request-context/request-context.service";

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: AuthUserRepository,
    private readonly tokenService: TokenService,
    private readonly requestContext: RequestContextService,
  ) {}

  async createSession(
    authUserId: string,
    refreshTokenStr: string,
  ): Promise<Session> {
    const refreshTokenHash =
      this.tokenService.hashRefreshToken(refreshTokenStr);
    const refreshTokenFamilyId = randomUUID();
    const expiresAt = new Date(
      Date.now() +
        this.tokenService.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    );

    const context = this.requestContext.get();

    const sessionData = {
      authUserId,
      refreshTokenHash,
      refreshTokenFamilyId,
      expiresAt,
      ipAddressEncrypted: context?.ip ? context.ip : null,
      userAgent: context?.userAgent,
    };

    return this.repository.createSession(
      sessionData,
      {
        eventType: "UserLoggedIn",
        authUserId,
        sessionId: refreshTokenFamilyId, // using familyId as stable session reference
        occurredAt: new Date().toISOString(),
        requestId: context?.requestId,
        correlationId: context?.correlationId,
      },
      context?.correlationId,
    );
  }

  async rotateSession(
    refreshTokenStr: string,
  ): Promise<{ session: Session; newRefreshTokenStr: string }> {
    const refreshTokenHash =
      this.tokenService.hashRefreshToken(refreshTokenStr);
    const session = await this.repository.findSession(refreshTokenHash);

    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const context = this.requestContext.get();

    if (session.status !== "ACTIVE" || session.expiresAt < new Date()) {
      // Token reuse detected or expired! Revoke family.
      await this.repository.revokeFamily(
        session.refreshTokenFamilyId,
        {
          eventType: "TokenFamilyRevoked",
          familyId: session.refreshTokenFamilyId,
          reason: "Token Reuse Detected or Expired Token",
          occurredAt: new Date().toISOString(),
          requestId: context?.requestId,
          correlationId: context?.correlationId,
        },
        context?.correlationId,
      );
      throw new UnauthorizedException(
        "Session revoked due to suspicious activity. Please login again.",
      );
    }

    const newRefreshTokenStr = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash =
      this.tokenService.hashRefreshToken(newRefreshTokenStr);
    const expiresAt = new Date(
      Date.now() +
        this.tokenService.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    );

    const updatedSession = await this.repository.rotateSession(
      session.id,
      {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
        lastUsedAt: new Date(),
      },
      {
        eventType: "TokenRotated",
        sessionId: session.id,
        occurredAt: new Date().toISOString(),
        requestId: context?.requestId,
        correlationId: context?.correlationId,
      },
      context?.correlationId,
    );

    return { session: updatedSession, newRefreshTokenStr };
  }

  async revokeSession(refreshTokenStr: string): Promise<void> {
    const refreshTokenHash =
      this.tokenService.hashRefreshToken(refreshTokenStr);
    const session = await this.repository.findSession(refreshTokenHash);

    if (session && session.status === "ACTIVE") {
      const context = this.requestContext.get();
      await this.repository.revokeSession(
        session.id,
        {
          eventType: "UserLoggedOut",
          sessionId: session.id,
          occurredAt: new Date().toISOString(),
          requestId: context?.requestId,
          correlationId: context?.correlationId,
        },
        context?.correlationId,
      );
    }
  }
}
