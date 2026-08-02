import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  public readonly accessTokenExpiresIn = 900; // 15 mins
  public readonly refreshTokenExpiresInDays = 30; // 30 days

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret =
      this.configService.get<string>("JWT_ACCESS_SECRET") ||
      "super-secret-jwt-key";
  }

  signAccessToken(authUserId: string, sessionId: string): string {
    return jwt.sign({ sub: authUserId, sid: sessionId }, this.jwtSecret, {
      expiresIn: this.accessTokenExpiresIn,
    });
  }

  verifyAccessToken(token: string): any {
    return jwt.verify(token, this.jwtSecret);
  }

  generateRefreshToken(): string {
    // 256-bit random opaque string
    return crypto.randomBytes(32).toString("hex");
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
