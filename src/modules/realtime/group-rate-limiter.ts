/**
 * Simple in-memory rate limiter keyed by casino group (FR-C3).
 * Resets on a fixed window; suitable for dev/single-instance MVP.
 */
export class GroupRateLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number,
  ) {}

  tryConsume(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= this.maxPerWindow) {
      return false;
    }
    bucket.count += 1;
    return true;
  }
}
