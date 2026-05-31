import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { EnvConfig } from '../config/env.validation';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService<EnvConfig, true>) {
    this.client = new Redis(configService.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    // Without a listener, ioredis surfaces connection failures as unhandled
    // 'error' events, which crash the process or spam noisy logs.
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
