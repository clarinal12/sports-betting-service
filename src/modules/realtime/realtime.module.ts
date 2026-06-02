import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { DatabaseModule } from '../../shared/database/database.module';
import { RealtimeAccessService } from './realtime-access.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePubSubService } from './realtime-pubsub.service';

@Module({
  imports: [DatabaseModule, CacheModule, AuthModule],
  providers: [RealtimeAccessService, RealtimeGateway, RealtimePubSubService],
  exports: [RealtimePubSubService],
})
export class RealtimeModule {}
