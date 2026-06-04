import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EnvConfig } from '../../shared/config/env.validation';
import { ResultsIngestService } from './results-ingest.service';

const RESULTS_SETTLEMENT_INTERVAL = 'results-settlement-poll';

@Injectable()
export class ResultsSettlementWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResultsSettlementWorker.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly results: ResultsIngestService,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') {
      return;
    }
    if (!this.config.get('RESULTS_INGEST_ENABLED', { infer: true })) {
      return;
    }
    const seconds = this.config.get('RESULTS_INGEST_POLL_SECONDS', {
      infer: true,
    });
    const handle = setInterval(() => {
      void this.poll();
    }, seconds * 1000);
    this.schedulerRegistry.addInterval(RESULTS_SETTLEMENT_INTERVAL, handle);
    this.logger.log(
      `Results + settlement worker enabled: every ${seconds}s (RESULTS_INGEST_POLL_SECONDS)`,
    );
  }

  onModuleDestroy(): void {
    if (
      this.schedulerRegistry.doesExist(
        'interval',
        RESULTS_SETTLEMENT_INTERVAL,
      )
    ) {
      this.schedulerRegistry.deleteInterval(RESULTS_SETTLEMENT_INTERVAL);
    }
  }

  private async poll(): Promise<void> {
    try {
      await this.results.runResultsAndSettlement();
    } catch (error) {
      this.logger.error(
        `Results/settlement poll failed: ${(error as Error).message}`,
      );
    }
  }
}
