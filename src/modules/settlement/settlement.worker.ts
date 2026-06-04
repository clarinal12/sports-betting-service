import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EnvConfig } from '../../shared/config/env.validation';
import { SettlementService } from './settlement.service';

const SETTLEMENT_INTERVAL = 'settlement-poll';

@Injectable()
export class SettlementWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementWorker.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly settlement: SettlementService,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') {
      return;
    }
    if (!this.config.get('SETTLEMENT_ENABLED', { infer: true })) {
      return;
    }
    if (this.config.get('RESULTS_INGEST_ENABLED', { infer: true })) {
      this.logger.log(
        'Settlement-only worker skipped (RESULTS_INGEST_ENABLED already runs settle after results ingest)',
      );
      return;
    }
    const seconds = this.config.get('SETTLEMENT_POLL_SECONDS', { infer: true });
    const handle = setInterval(() => {
      void this.poll();
    }, seconds * 1000);
    this.schedulerRegistry.addInterval(SETTLEMENT_INTERVAL, handle);
    this.logger.log(
      `Settlement worker enabled: every ${seconds}s (SETTLEMENT_POLL_SECONDS)`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', SETTLEMENT_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(SETTLEMENT_INTERVAL);
    }
  }

  private async poll(): Promise<void> {
    try {
      const count = await this.settlement.settleBatch();
      if (count > 0) {
        this.logger.log(`Settlement processed ${count} bet(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Settlement poll failed: ${(error as Error).message}`,
      );
    }
  }
}
