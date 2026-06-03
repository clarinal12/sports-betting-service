import { Module } from '@nestjs/common';
import { CacheModule } from '../../shared/cache/cache.module';
import { IngestLockService } from './ingest-lock.service';
import { IngestQuotaService } from './ingest-quota.service';

@Module({
  imports: [CacheModule],
  providers: [IngestLockService, IngestQuotaService],
  exports: [IngestLockService, IngestQuotaService],
})
export class IngestionSupportModule {}
