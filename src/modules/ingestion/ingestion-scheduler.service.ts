import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EnvConfig } from '../../shared/config/env.validation';
import {
  IngestLockService,
  INGEST_CATALOG_LOCK_KEY,
  INGEST_CATALOG_LOCK_TTL_SECONDS,
  INGEST_LIVE_LOCK_KEY,
} from './ingest-lock.service';
import { IngestQuotaService } from './ingest-quota.service';
import { IngestionService } from './ingestion.service';

const SCHEDULER_LIVE_INTERVAL_NAME = 'ingest-live-tick';
const SCHEDULER_CATALOG_CRON_NAME = 'ingest-catalog';

@Injectable()
export class IngestionSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionSchedulerService.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly ingestion: IngestionService,
    private readonly lock: IngestLockService,
    private readonly quota: IngestQuotaService,
  ) {}

  onModuleInit(): void {
    this.registerLiveScheduler();
    this.registerCatalogScheduler();
  }

  onModuleDestroy(): void {
    if (
      this.schedulerRegistry.doesExist('interval', SCHEDULER_LIVE_INTERVAL_NAME)
    ) {
      this.schedulerRegistry.deleteInterval(SCHEDULER_LIVE_INTERVAL_NAME);
    }
    if (this.schedulerRegistry.doesExist('cron', SCHEDULER_CATALOG_CRON_NAME)) {
      const job = this.schedulerRegistry.getCronJob(SCHEDULER_CATALOG_CRON_NAME);
      job.stop();
      this.schedulerRegistry.deleteCronJob(SCHEDULER_CATALOG_CRON_NAME);
    }
  }

  private registerLiveScheduler(): void {
    const enabled = this.config.get('INGEST_LIVE_ENABLED', { infer: true });
    const intervalSeconds = this.config.get('INGEST_LIVE_INTERVAL_SECONDS', {
      infer: true,
    });

    if (!enabled) {
      this.logger.log(
        'Live ingest scheduler disabled (set INGEST_LIVE_ENABLED=true to enable)',
      );
      return;
    }

    const intervalMs = intervalSeconds * 1000;
    const handle = setInterval(() => {
      void this.runLiveTick();
    }, intervalMs);
    this.schedulerRegistry.addInterval(SCHEDULER_LIVE_INTERVAL_NAME, handle);

    this.logger.log(
      `Live ingest scheduler enabled: every ${intervalSeconds}s (INGEST_LIVE_INTERVAL_SECONDS)`,
    );
    void this.runLiveTick();
  }

  private registerCatalogScheduler(): void {
    const enabled = this.config.get('INGEST_CATALOG_ENABLED', { infer: true });
    const cronExpr = this.config.get('INGEST_CATALOG_CRON', { infer: true });

    if (!enabled) {
      this.logger.log(
        'Catalog ingest scheduler disabled (set INGEST_CATALOG_ENABLED=true to enable)',
      );
      return;
    }

    const job = new CronJob(cronExpr, () => {
      void this.runCatalogIngest();
    });
    this.schedulerRegistry.addCronJob(SCHEDULER_CATALOG_CRON_NAME, job);
    job.start();

    this.logger.log(
      `Catalog ingest scheduler enabled: cron "${cronExpr}" (INGEST_CATALOG_CRON)`,
    );
  }

  async runLiveTick(): Promise<void> {
    if (!this.config.get('INGEST_LIVE_ENABLED', { infer: true })) {
      return;
    }

    if (await this.quota.isPaused()) {
      this.logger.debug(
        'Live ingest skipped: Odds API ingest paused (quota/auth)',
      );
      return;
    }

    const intervalSeconds = this.config.get('INGEST_LIVE_INTERVAL_SECONDS', {
      infer: true,
    });
    const lockTtl = Math.max(intervalSeconds - 5, 10);
    const acquired = await this.lock.tryAcquire(INGEST_LIVE_LOCK_KEY, lockTtl);
    if (!acquired) {
      this.logger.debug('Live ingest skipped: lock held by another instance');
      return;
    }

    try {
      await this.ingestion.ingestLiveTick();
    } catch (error) {
      this.logger.error(
        `Live ingest tick failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  async runCatalogIngest(): Promise<void> {
    if (!this.config.get('INGEST_CATALOG_ENABLED', { infer: true })) {
      return;
    }

    if (await this.quota.isPaused()) {
      this.logger.debug(
        'Catalog ingest skipped: Odds API ingest paused (quota/auth)',
      );
      return;
    }

    const acquired = await this.lock.tryAcquire(
      INGEST_CATALOG_LOCK_KEY,
      INGEST_CATALOG_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      this.logger.debug('Catalog ingest skipped: lock held by another instance');
      return;
    }

    try {
      await this.ingestion.ingestFixtures();
    } catch (error) {
      this.logger.error(
        `Catalog ingest failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
