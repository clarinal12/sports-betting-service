import { GroupRateLimiter } from './group-rate-limiter';

describe('GroupRateLimiter', () => {
  it('allows up to max operations per window', () => {
    const limiter = new GroupRateLimiter(2, 60_000);
    expect(limiter.tryConsume('acme')).toBe(true);
    expect(limiter.tryConsume('acme')).toBe(true);
    expect(limiter.tryConsume('acme')).toBe(false);
  });

  it('tracks groups independently', () => {
    const limiter = new GroupRateLimiter(1, 60_000);
    expect(limiter.tryConsume('acme')).toBe(true);
    expect(limiter.tryConsume('betzone')).toBe(true);
    expect(limiter.tryConsume('acme')).toBe(false);
  });
});
