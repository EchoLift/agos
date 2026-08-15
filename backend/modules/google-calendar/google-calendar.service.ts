import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@packages/database/prisma.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ConnectGoogleCalendarDto } from "./dto/connect-google-calendar.dto";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth.service";
import { GoogleCalendarSyncService } from "./google-calendar-sync.service";

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauth: GoogleCalendarOAuthService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  async status(actor: IdentityContext) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: actor.userId },
    });

    if (!connection || !connection.syncEnabled) {
      return { connected: false };
    }

    return {
      connected: true,
      email: connection.googleAccountEmail,
      calendarName: "AGENCIE",
      calendarId: connection.googleCalendarId,
      lastSyncedAt: connection.lastSyncAt,
      requiresReconnect: Boolean(connection.revokedAt),
      syncEnabled: connection.syncEnabled,
    };
  }

  async connect(dto: ConnectGoogleCalendarDto, actor: IdentityContext) {
    const agencySlug = await this.resolveAgencySlug(dto.agencySlug, actor);

    return {
      authorizationUrl: this.oauth.buildAuthorizationUrl(
        actor.userId,
        agencySlug,
      ),
    };
  }

  async completeOAuthCallback(code: string, state: string) {
    const oauthState = this.oauth.validateState(state);
    const token = await this.oauth.exchangeCode(code);
    const existing = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: oauthState.userId },
    });

    const refreshToken = token.refresh_token;
    if (!refreshToken && !existing?.encryptedRefreshToken) {
      throw new BadRequestException(
        "Google did not return a refresh token. Please reconnect Google Calendar.",
      );
    }

    const calendarId = await this.oauth.ensureAgencieCalendar(
      token.access_token ?? "",
      existing?.googleCalendarId,
    );
    const email = await this.oauth.getGoogleAccountEmail(
      token.access_token ?? "",
    );
    const encryptedRefreshToken = refreshToken
      ? this.oauth.encryptRefreshToken(refreshToken)
      : existing?.encryptedRefreshToken;

    await this.prisma.googleCalendarConnection.upsert({
      where: { userId: oauthState.userId },
      create: {
        userId: oauthState.userId,
        googleAccountEmail: email,
        googleCalendarId: calendarId,
        encryptedRefreshToken: encryptedRefreshToken ?? "",
        tokenExpiresAt: this.oauth.tokenExpiresAt(token),
        grantedScopes: this.oauth.scopesFrom(token),
        syncEnabled: true,
        revokedAt: null,
      },
      update: {
        googleAccountEmail: email,
        googleCalendarId: calendarId,
        encryptedRefreshToken,
        tokenExpiresAt: this.oauth.tokenExpiresAt(token),
        grantedScopes: this.oauth.scopesFrom(token),
        syncEnabled: true,
        revokedAt: null,
      },
    });

    await this.syncService.syncUser(oauthState.userId);

    return this.settingsRedirect(oauthState.agencySlug, "connected");
  }

  async syncNow(actor: IdentityContext) {
    return this.syncService.syncUser(actor.userId);
  }

  async disconnect(actor: IdentityContext) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: actor.userId },
    });

    if (!connection) {
      return { disconnected: true };
    }

    try {
      await this.oauth.revoke(connection);
    } catch (error) {
      this.logger.warn(
        `Google Calendar revoke failed for user ${actor.userId}: ${this.safeError(error)}`,
      );
    }

    await this.prisma.googleCalendarConnection.update({
      where: { userId: actor.userId },
      data: {
        syncEnabled: false,
        revokedAt: new Date(),
      },
    });

    return { disconnected: true };
  }

  callbackErrorRedirect(state?: string) {
    if (!state) return this.settingsRedirect(undefined, "error");
    try {
      const oauthState = this.oauth.validateState(state);
      return this.settingsRedirect(oauthState.agencySlug, "error");
    } catch {
      return this.settingsRedirect(undefined, "error");
    }
  }

  private async resolveAgencySlug(
    requestedSlug: string | undefined,
    actor: IdentityContext,
  ) {
    if (requestedSlug) {
      const agency = await this.prisma.agency.findFirst({
        where: {
          slug: requestedSlug,
          memberships: {
            some: { userId: actor.userId, status: "ACTIVE" },
          },
        },
        select: { slug: true },
      });
      if (!agency) throw new ForbiddenException("Workspace access required");
      return agency.slug;
    }

    if (!actor.agencyId) return undefined;
    const agency = await this.prisma.agency.findFirst({
      where: {
        id: actor.agencyId,
        memberships: { some: { userId: actor.userId, status: "ACTIVE" } },
      },
      select: { slug: true },
    });

    return agency?.slug;
  }

  private settingsRedirect(agencySlug: string | undefined, status: string) {
    const params = new URLSearchParams({ googleCalendar: status });
    if (!agencySlug) {
      const appUrl = this.frontendUrl();
      return `${appUrl}/login?${params.toString()}`;
    }

    if (this.config.get<string>("NODE_ENV") === "production") {
      return `https://${agencySlug}.${this.rootDomain()}/settings/profile?${params.toString()}`;
    }

    return `${this.frontendUrl()}/${agencySlug}/settings/profile?${params.toString()}`;
  }

  private frontendUrl() {
    return (
      this.config.get<string>("FRONTEND_URL") ??
      this.config.get<string>("APP_URL") ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }

  private rootDomain() {
    return this.config.get<string>("ROOT_DOMAIN") ?? "agencie.in";
  }

  private safeError(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
