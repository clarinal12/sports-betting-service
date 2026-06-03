import { IngestLockService } from './ingest-lock.service';
import { RedisService } from '../../shared/cache/redis.service';

describe('IngestLockService', () => {
  it('returns false when SET NX does not acquire', async () => {
    const redis = {
      getClient: () => ({
        set: jest.fn(async () => null),
      }),
    } as unknown as RedisService;

    const service = new IngestLockService(redis);
    await expect(service.tryAcquire('ingest:live:lock', 55)).resolves.toBe(false);
  });

  it('returns true when SET NX succeeds', async () => {
    const redis = {
      getClient: () => ({
        set: jest.fn(async () => 'OK'),
      }),
    } as unknown as RedisService;

    const service = new IngestLockService(redis);
    await expect(service.tryAcquire('ingest:live:lock', 55)).resolves.toBe(true);
  });
});
