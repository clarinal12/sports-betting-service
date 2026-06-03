import { ConfigService } from '@nestjs/config';
import { IngestQuotaService } from './ingest-quota.service';
import { RedisService } from '../../shared/cache/redis.service';

describe('IngestQuotaService', () => {
  const redisStore = new Map<string, string>();

  const redis = {
    getClient: () => ({
      get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
      set: jest.fn(
        async (key: string, value: string, _ex: string, ttl: number) => {
          redisStore.set(key, value);
          return 'OK';
        },
      ),
      del: jest.fn(async (key: string) => {
        redisStore.delete(key);
      }),
    }),
  } as unknown as RedisService;

  const config = {
    get: (key: string) => {
      if (key === 'INGEST_ODDS_API_REMAINING_MIN') {
        return 20;
      }
      if (key === 'INGEST_ODDS_API_PAUSE_MINUTES') {
        return 30;
      }
      return undefined;
    },
  } as unknown as ConfigService;

  let service: IngestQuotaService;

  beforeEach(() => {
    redisStore.clear();
    service = new IngestQuotaService(redis, config);
  });

  it('is not paused when no key is set', async () => {
    await expect(service.isPaused()).resolves.toBe(false);
  });

  it('pauses when remaining quota is below threshold', async () => {
    await service.recordQuotaHeaders({ 'x-requests-remaining': '5' });
    await expect(service.isPaused()).resolves.toBe(true);
  });

  it('pauses on auth failure', async () => {
    await service.pauseForAuthFailure();
    await expect(service.isPaused()).resolves.toBe(true);
  });
});
