import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../shared/cache/redis.service';

export const INGEST_LIVE_LOCK_KEY = 'ingest:live:lock';
export const INGEST_CATALOG_LOCK_KEY = 'ingest:catalog:lock';

/** Max expected catalog ingest duration; lock expires if a run stalls. */
export const INGEST_CATALOG_LOCK_TTL_SECONDS = 3600;

@Injectable()
export class IngestLockService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Acquires a short-lived distributed lock (SET NX EX). Returns false when
   * another instance already holds the lock.
   */
  async tryAcquire(key: string, ttlSeconds: number): Promise<boolean> {
    const token = randomUUID();
    const result = await this.redis
      .getClient()
      .set(key, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }
}
