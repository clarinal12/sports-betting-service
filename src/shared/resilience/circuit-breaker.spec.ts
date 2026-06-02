import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  const fail = () => Promise.reject(new Error('boom'));
  const ok = () => Promise.resolve('ok');

  it('passes through successful calls and stays closed', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 100,
    });
    await expect(breaker.execute(ok)).resolves.toBe('ok');
    expect(breaker.currentState).toBe('closed');
  });

  it('opens after the failure threshold and then fails fast', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 1000,
    });

    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    expect(breaker.currentState).toBe('open');

    // Now fails fast without invoking fn.
    await expect(breaker.execute(ok)).rejects.toThrow('Circuit is open');
  });

  it('half-opens after cooldown and closes on a successful trial', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 5 });
    await expect(breaker.execute(fail)).rejects.toThrow('boom');
    expect(breaker.currentState).toBe('open');

    await new Promise((r) => setTimeout(r, 10));
    await expect(breaker.execute(ok)).resolves.toBe('ok');
    expect(breaker.currentState).toBe('closed');
  });
});
