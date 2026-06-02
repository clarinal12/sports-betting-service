export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. */
  failureThreshold: number;
  /** How long the circuit stays open before a half-open trial (ms). */
  cooldownMs: number;
}

/**
 * Minimal consecutive-failure circuit breaker. When an upstream fails
 * `failureThreshold` times in a row the circuit opens and calls fail fast for
 * `cooldownMs`; the next call is a half-open trial that either closes the
 * circuit (success) or re-opens it (failure).
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  get currentState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.options.cooldownMs) {
        throw new Error('Circuit is open');
      }
      this.state = 'half-open';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures += 1;
    if (
      this.state === 'half-open' ||
      this.failures >= this.options.failureThreshold
    ) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}
