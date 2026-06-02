import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { EnvConfig } from '../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:v1:';

/**
 * Symmetric encryption for secrets at rest (e.g. per-merchant sportsSecret).
 * Uses AES-256-GCM; the 32-byte key is derived from SECRET_ENCRYPTION_KEY so
 * any sufficiently long passphrase works. Encrypted values are tagged with a
 * version prefix so we can detect plaintext and rotate schemes later.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    const secret = this.config.get('SECRET_ENCRYPTION_KEY', { infer: true });
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(value: string): string {
    if (!value.startsWith(PREFIX)) {
      throw new Error('Value is not encrypted with the expected scheme');
    }
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = raw.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(PREFIX);
  }
}
