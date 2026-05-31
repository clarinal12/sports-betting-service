import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ProvidersModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
