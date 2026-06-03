import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProvidersModule } from '../providers/providers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IngestionSchedulerService } from './ingestion-scheduler.service';
import { IngestionSupportModule } from './ingestion-support.module';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    IngestionSupportModule,
    ProvidersModule,
    RealtimeModule,
  ],
  providers: [IngestionService, IngestionSchedulerService],
  exports: [IngestionService],
})
export class IngestionModule {}
