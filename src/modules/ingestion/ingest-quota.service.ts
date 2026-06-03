import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosResponse } from 'axios';
import { EnvConfig } from '../../shared/config/env.validation';
import { RedisService } from '../../shared/cache/redis.service';

const PAUSED_UNTIL_KEY = 'ingest:odds-api:paused-until';

@Injectable()
export class IngestQuotaService {
  private readonly logger = new Logger(IngestQuotaService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async isPaused(): Promise<boolean> {
    const raw = await this.redis.getClient().get(PAUSED_UNTIL_KEY);
    if (!raw) {
      return false;
    }
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      await this.redis.getClient().del(PAUSED_UNTIL_KEY);
      return false;
    }
    return true;
  }

  async recordQuotaHeaders(headers: AxiosResponse['headers']): Promise<void> {
    const remainingRaw = headers['x-requests-remaining'];
    if (remainingRaw === undefined) {
      return;
    }
    const remaining = Number(remainingRaw);
    if (!Number.isFinite(remaining)) {
      return;
    }

    const min = this.config.get('INGEST_ODDS_API_REMAINING_MIN', { infer: true });
    if (remaining >= min) {
      return;
    }

    const pauseMinutes = this.config.get('INGEST_ODDS_API_PAUSE_MINUTES', {
      infer: true,
    });
    await this.pauseForMinutes(
      pauseMinutes,
      `Odds API quota low (remaining=${remaining}, threshold=${min})`,
    );
  }

  async pauseForAuthFailure(): Promise<void> {
    const pauseMinutes = this.config.get('INGEST_ODDS_API_PAUSE_MINUTES', {
      infer: true,
    });
    await this.pauseForMinutes(
      pauseMinutes,
      'Odds API returned HTTP 401 (invalid or missing API key)',
    );
  }

  private async pauseForMinutes(minutes: number, reason: string): Promise<void> {
    const until = Date.now() + minutes * 60_000;
    const existing = await this.redis.getClient().get(PAUSED_UNTIL_KEY);
    const existingUntil = existing ? Number(existing) : 0;
    if (existingUntil > until) {
      return;
    }

    await this.redis
      .getClient()
      .set(PAUSED_UNTIL_KEY, String(until), 'EX', minutes * 60);
    this.logger.warn(
      `Odds API ingest paused for ${minutes} minute(s): ${reason}`,
    );
  }
}
