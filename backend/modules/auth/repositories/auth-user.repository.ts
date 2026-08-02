import { Injectable } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { Prisma, AuthUser, Session, AuthProvider } from "@prisma/client";

@Injectable()
export class AuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmailHash(emailHash: string): Promise<AuthUser | null> {
    return this.prisma.authUser.findUnique({ where: { emailHash } });
  }

  async findByProviderIdentity(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthUser | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { authUser: true },
    });
    return identity?.authUser ?? null;
  }

  async findByProviderIdentityOrEmail(
    provider: AuthProvider,
    providerUserId: string,
    emailHash: string,
  ): Promise<{ user: AuthUser | null; matchedProvider: boolean }> {
    const providerUser = await this.findByProviderIdentity(
      provider,
      providerUserId,
    );
    if (providerUser) {
      return { user: providerUser, matchedProvider: true };
    }

    const emailUser = await this.findByEmailHash(emailHash);
    return { user: emailUser, matchedProvider: false };
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    return this.prisma.authUser.findUnique({ where: { id } });
  }

  async linkProviderIdentity(
    authUserId: string,
    provider: AuthProvider,
    providerUserId: string,
    emailHash: string | null,
    eventPayload: any,
    correlationId?: string,
  ): Promise<AuthUser> {
    return this.prisma.$transaction(async (tx) => {
      await tx.authIdentity.create({
        data: { authUserId, provider, providerUserId, emailHash },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: authUserId,
          aggregateType: "AuthUser",
          eventType: eventPayload.eventType ?? "AuthProviderLinked",
          payload: eventPayload,
          correlationId,
        },
      });

      return tx.authUser.findUniqueOrThrow({ where: { id: authUserId } });
    });
  }

  async createUser(
    userData: Prisma.AuthUserCreateInput,
    eventPayload: any,
    correlationId?: string,
  ): Promise<AuthUser> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.authUser.create({ data: userData });

      await tx.outboxEvent.create({
        data: {
          aggregateId: user.id,
          aggregateType: "AuthUser",
          eventType: eventPayload.eventType ?? "UserRegistered",
          payload: { ...eventPayload, authUserId: user.id },
          correlationId,
        },
      });

      return user;
    });
  }

  async findSession(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  async findSessionById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async createSession(
    sessionData: Prisma.SessionUncheckedCreateInput,
    eventPayload: any,
    correlationId?: string,
  ): Promise<Session> {
    return this.prisma.session.create({ data: sessionData });
  }

  async rotateSession(
    sessionId: string,
    newSessionData: Prisma.SessionUncheckedUpdateInput,
    eventPayload: any,
    correlationId?: string,
  ): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: newSessionData,
    });
  }

  async revokeSession(
    sessionId: string,
    eventPayload: any,
    correlationId?: string,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  }

  async revokeFamily(
    familyId: string,
    eventPayload: any,
    correlationId?: string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenFamilyId: familyId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  }
}
