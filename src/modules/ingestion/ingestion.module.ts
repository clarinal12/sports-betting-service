import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ProvidersModule, RealtimeModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
