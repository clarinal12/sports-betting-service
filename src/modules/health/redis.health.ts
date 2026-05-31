import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { RedisService } from '../../shared/cache/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redis: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return indicator.down({
          message: `Unexpected Redis ping response: ${pong}`,
        });
      }
      return indicator.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Redis unreachable';
      return indicator.down({ message });
    }
  }
}
