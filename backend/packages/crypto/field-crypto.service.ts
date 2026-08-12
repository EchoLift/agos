import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class FieldCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plainText: string): string {
    const key = this.getHashedEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  decrypt(cipherText: string): string {
    if (!cipherText) return "";

    // 1. Try colon-separated format (CryptoService / OrganizationService standard)
    if (cipherText.includes(":")) {
      const parts = cipherText.split(":");
      if (parts.length === 3) {
        const [ivHex, authTagHex, encryptedData] = parts;
        try {
          const key = this.getHashedEncryptionKey();
          const iv = Buffer.from(ivHex, "hex");
          const authTag = Buffer.from(authTagHex, "hex");
          const decipher = createDecipheriv("aes-256-gcm", key, iv);
          decipher.setAuthTag(authTag);
          let decrypted = decipher.update(encryptedData, "hex", "utf8");
          decrypted += decipher.final("utf8");
          return decrypted;
        } catch {
          // Fall through to base64 fallback below
        }
      }
    }

    // 2. Fallback: Base64 binary format
    try {
      const key = this.getRawEncryptionKey();
      const payload = Buffer.from(cipherText, "base64");
      const iv = payload.subarray(0, 12);
      const tag = payload.subarray(12, 28);
      const encrypted = payload.subarray(28);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8");
    } catch (err: any) {
      throw new Error(`Failed to decrypt ciphertext: ${err.message}`);
    }
  }

  lookupHash(value: string): string {
    const secret = this.config.get<string>("FIELD_LOOKUP_SECRET") ?? "";
    return createHmac("sha256", secret)
      .update(value.trim().toLowerCase())
      .digest("hex");
  }

  private getHashedEncryptionKey(): Buffer {
    const rawKey =
      this.config.get<string>("ENCRYPTION_SECRET") ??
      this.config.get<string>("FIELD_ENCRYPTION_KEY_BASE64") ??
      "";
    return createHash("sha256").update(rawKey).digest();
  }

  private getRawEncryptionKey(): Buffer {
    const rawKey = this.config.get<string>("FIELD_ENCRYPTION_KEY_BASE64") ?? "";
    const key = Buffer.from(rawKey, "base64");
    if (key.length !== 32) {
      return this.getHashedEncryptionKey();
    }
    return key;
  }
}
