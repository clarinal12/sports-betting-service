import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProvidersModule } from '../providers/providers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SettlementModule } from '../settlement/settlement.module';
import { IngestionSchedulerService } from './ingestion-scheduler.service';
import { IngestionSupportModule } from './ingestion-support.module';
import { IngestionService } from './ingestion.service';
import { ResultsIngestService } from './results-ingest.service';
import { ResultsSettlementWorker } from './results-settlement.worker';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    IngestionSupportModule,
    ProvidersModule,
    RealtimeModule,
    SettlementModule,
  ],
  providers: [
    IngestionService,
    IngestionSchedulerService,
    ResultsIngestService,
    ResultsSettlementWorker,
  ],
  exports: [IngestionService, ResultsIngestService],
})
export class IngestionModule {}
