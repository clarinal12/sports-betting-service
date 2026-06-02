import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

function makeService(key = 'unit-test-encryption-key-1234'): CryptoService {
  const config = {
    get: () => key,
  } as unknown as ConfigService;
  return new CryptoService(config);
}

describe('CryptoService', () => {
  it('round-trips a value through encrypt/decrypt', () => {
    const crypto = makeService();
    const secret = 'super-secret-merchant-key';
    const encrypted = crypto.encrypt(secret);

    expect(encrypted).not.toContain(secret);
    expect(crypto.isEncrypted(encrypted)).toBe(true);
    expect(crypto.decrypt(encrypted)).toBe(secret);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const crypto = makeService();
    expect(crypto.encrypt('x')).not.toBe(crypto.encrypt('x'));
  });

  it('rejects values that are not encrypted with the scheme', () => {
    const crypto = makeService();
    expect(() => crypto.decrypt('plaintext')).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const encrypted = makeService('key-aaaaaaaaaaaaaaaa').encrypt('hello');
    expect(() =>
      makeService('key-bbbbbbbbbbbbbbbb').decrypt(encrypted),
    ).toThrow();
  });
});
