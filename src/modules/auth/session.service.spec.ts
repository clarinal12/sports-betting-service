import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { UserContext } from './user-context.types';

function makeService(): SessionService {
  const values: Record<string, string> = {
    SESSION_JWT_SECRET: 'unit-test-session-secret-1234',
    SESSION_TTL: '30m',
  };
  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
  return new SessionService(config);
}

const user: UserContext = {
  userId: 'u1',
  username: 'alice',
  casinoGroupId: 'grp_1',
  currency: 'USD',
};

describe('SessionService', () => {
  it('mints a token that verifies back to the same user', () => {
    const service = makeService();
    const { sessionToken, expiresIn } = service.mint(user);

    expect(expiresIn).toBe('30m');
    expect(service.verify(sessionToken)).toEqual(user);
  });

  it('rejects a tampered/invalid token', () => {
    const service = makeService();
    expect(() => service.verify('not-a-jwt')).toThrow(UnauthorizedException);
  });
});
