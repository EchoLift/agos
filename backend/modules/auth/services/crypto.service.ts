import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

@Injectable()
export class CryptoService {
  private readonly encryptionSecret: string;
  private readonly lookupSecret: string;

  constructor(private readonly configService: ConfigService) {
    const encSecret =
      this.configService.get<string>("ENCRYPTION_SECRET") ??
      this.configService.get<string>("FIELD_ENCRYPTION_KEY_BASE64");
    const lkpSecret = this.configService.get<string>("FIELD_LOOKUP_SECRET");

    if (!encSecret || !lkpSecret) {
      throw new InternalServerErrorException(
        "Crypto secrets are not configured",
      );
    }

    // Convert to buffer assuming it's provided as a base64 or raw string.
    // We'll hash it to guarantee a 32-byte key for AES-256.
    this.encryptionSecret = crypto
      .createHash("sha256")
      .update(encSecret)
      .digest("hex")
      .substring(0, 64);
    this.lookupSecret = lkpSecret;
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionSecret, "hex");
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encryptedData] = encryptedText.split(":");
    if (!ivHex || !authTagHex || !encryptedData) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = Buffer.from(this.encryptionSecret, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  hashLookup(text: string): string {
    return crypto
      .createHmac("sha256", this.lookupSecret)
      .update(text)
      .digest("hex");
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  hashEmailLookup(email: string): string {
    return this.hashLookup(this.normalizeEmail(email));
  }
}
