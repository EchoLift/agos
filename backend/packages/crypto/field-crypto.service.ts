import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FieldCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plainText: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(cipherText: string): string {
    const key = this.getEncryptionKey();
    const payload = Buffer.from(cipherText, 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  lookupHash(value: string): string {
    const secret = this.config.get<string>('FIELD_LOOKUP_SECRET') ?? '';
    return createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
  }

  private getEncryptionKey(): Buffer {
    const rawKey = this.config.get<string>('FIELD_ENCRYPTION_KEY_BASE64') ?? '';
    const key = Buffer.from(rawKey, 'base64');

    if (key.length !== 32) {
      throw new Error('FIELD_ENCRYPTION_KEY_BASE64 must decode to 32 bytes');
    }

    return key;
  }
}

