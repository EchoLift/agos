import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleCalendarConnection } from "@prisma/client";
import { CryptoService } from "@modules/auth/services/crypto.service";
import * as crypto from "crypto";

type OAuthState = {
  userId: string;
  agencySlug?: string;
  issuedAt: number;
  nonce: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarEvent = {
  id: string;
};

@Injectable()
export class GoogleCalendarOAuthService {
  private readonly logger = new Logger(GoogleCalendarOAuthService.name);
  private readonly calendarName = "AGENCIE";
  private readonly stateTtlMs = 10 * 60 * 1000;
  private readonly scopes = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.app.created",
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  buildAuthorizationUrl(userId: string, agencySlug?: string) {
    const state = this.signState({
      userId,
      agencySlug,
      issuedAt: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.clientId());
    url.searchParams.set("redirect_uri", this.redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", this.scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);

    return url.toString();
  }

  validateState(state: string): OAuthState {
    const [payload, signature] = state.split(".");
    if (!payload || !signature) {
      throw new UnauthorizedException("Invalid Google Calendar OAuth state");
    }

    const expected = this.hmac(payload);
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new UnauthorizedException("Invalid Google Calendar OAuth state");
    }

    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as OAuthState;

    if (!parsed.userId || Date.now() - parsed.issuedAt > this.stateTtlMs) {
      throw new UnauthorizedException("Expired Google Calendar OAuth state");
    }

    return parsed;
  }

  async exchangeCode(code: string) {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      redirect_uri: this.redirectUri(),
      grant_type: "authorization_code",
    });

    const token = await this.fetchToken(body);
    if (!token.access_token) {
      throw new BadRequestException("Google did not return an access token");
    }

    return token;
  }

  async refreshAccessToken(connection: GoogleCalendarConnection) {
    const refreshToken = this.cryptoService.decrypt(
      connection.encryptedRefreshToken,
    );
    const body = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    return this.fetchToken(body);
  }

  async getGoogleAccountEmail(accessToken: string) {
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!response.ok) return null;
      const profile = (await response.json()) as { email?: string };
      return profile.email ?? null;
    } catch (error) {
      this.logger.warn(
        `Unable to read Google user profile: ${this.safeError(error)}`,
      );
      return null;
    }
  }

  async ensureAgencieCalendar(
    accessToken: string,
    storedCalendarId?: string | null,
  ) {
    if (storedCalendarId) {
      return storedCalendarId;
    }

    const calendar = await this.createCalendar(accessToken);
    return calendar.id;
  }

  encryptRefreshToken(refreshToken: string) {
    return this.cryptoService.encrypt(refreshToken);
  }

  scopesFrom(token: TokenResponse) {
    return (token.scope ?? this.scopes.join(" "))
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  tokenExpiresAt(token: TokenResponse) {
    if (!token.expires_in) return null;
    return new Date(Date.now() + token.expires_in * 1000);
  }

  async createEvent(accessToken: string, calendarId: string, event: unknown) {
    const created = await this.calendarFetch<GoogleCalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        body: JSON.stringify(event),
      },
    );
    return created.id;
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: unknown,
  ) {
    await this.calendarFetch<GoogleCalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(event),
      },
    );
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (response.ok || response.status === 404 || response.status === 410) {
      return;
    }

    throw new ServiceUnavailableException(
      `Google Calendar event delete failed with ${response.status}`,
    );
  }

  async revoke(connection: GoogleCalendarConnection) {
    const refreshToken = this.cryptoService.decrypt(
      connection.encryptedRefreshToken,
    );
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });

    if (!response.ok && response.status !== 400) {
      throw new ServiceUnavailableException(
        `Google OAuth revoke failed with ${response.status}`,
      );
    }
  }

  private createCalendar(accessToken: string) {
    return this.calendarFetch<{ id: string }>(accessToken, "/calendars", {
      method: "POST",
      body: JSON.stringify({
        summary: this.calendarName,
        timeZone: "UTC",
      }),
    });
  }

  private async calendarFetch<T>(
    accessToken: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3${path}`,
      {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(init.headers ?? {}),
        },
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Google Calendar API request failed with ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }

  private async fetchToken(body: URLSearchParams) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const token = (await response.json()) as TokenResponse;
    if (!response.ok || token.error) {
      if (token.error === "invalid_grant") {
        throw new UnauthorizedException(
          "Google Calendar authorization was revoked",
        );
      }

      throw new BadRequestException(
        token.error_description ?? "Google OAuth token exchange failed",
      );
    }

    return token;
  }

  private signState(state: OAuthState) {
    const payload = Buffer.from(JSON.stringify(state), "utf8").toString(
      "base64url",
    );
    return `${payload}.${this.hmac(payload)}`;
  }

  private hmac(payload: string) {
    return crypto
      .createHmac("sha256", this.stateSecret())
      .update(payload)
      .digest("base64url");
  }

  private clientId() {
    return this.required("GOOGLE_CLIENT_ID");
  }

  private clientSecret() {
    return this.required("GOOGLE_CLIENT_SECRET");
  }

  private redirectUri() {
    return this.required("GOOGLE_CALENDAR_REDIRECT_URI");
  }

  private stateSecret() {
    return (
      this.config.get<string>("GOOGLE_CALENDAR_OAUTH_STATE_SECRET") ??
      this.config.get<string>("JWT_REFRESH_SECRET") ??
      this.required("JWT_ACCESS_SECRET")
    );
  }

  private required(name: string) {
    const value = this.config.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }
    return value;
  }

  private safeError(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
