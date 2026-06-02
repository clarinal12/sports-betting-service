import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';
import { OperatorTokenVerifier } from './operator-token.verifier';

const SECRET = 'merchant-secret-key';
const MERCHANT_ID = 'acme-merchant';

const group = {
  id: 'grp_1',
  slug: 'acme',
  name: 'Acme',
  defaultCurrency: 'USD',
  timezone: 'UTC',
};

function makeVerifier(secret: string | null): OperatorTokenVerifier {
  const config = {
    get: () => 5,
  } as unknown as ConfigService;
  const casinoGroups = {
    getMerchantCredentials: jest
      .fn()
      .mockResolvedValue(
        secret === null ? null : { group, sportsSecret: secret },
      ),
  } as unknown as CasinoGroupsService;
  return new OperatorTokenVerifier(config, casinoGroups);
}

function sign(
  secret: string,
  payload: object,
  opts: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', ...opts });
}

describe('OperatorTokenVerifier', () => {
  it('verifies a valid token and returns payload + credentials', async () => {
    const verifier = makeVerifier(SECRET);
    const token = sign(SECRET, {
      userId: 'u1',
      username: 'alice',
      merchantId: MERCHANT_ID,
    });

    const result = await verifier.verify(token);
    expect(result.payload.userId).toBe('u1');
    expect(result.payload.merchantId).toBe(MERCHANT_ID);
    expect(result.credentials.group.id).toBe('grp_1');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const verifier = makeVerifier(SECRET);
    const token = sign('wrong-secret', {
      userId: 'u1',
      username: 'alice',
      merchantId: MERCHANT_ID,
    });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the merchant is unknown', async () => {
    const verifier = makeVerifier(null);
    const token = sign(SECRET, {
      userId: 'u1',
      username: 'alice',
      merchantId: 'ghost',
    });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const verifier = makeVerifier(SECRET);
    const token = sign(
      SECRET,
      { userId: 'u1', username: 'alice', merchantId: MERCHANT_ID },
      { expiresIn: -10 },
    );
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token missing merchantId', async () => {
    const verifier = makeVerifier(SECRET);
    const token = sign(SECRET, { userId: 'u1', username: 'alice' });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
