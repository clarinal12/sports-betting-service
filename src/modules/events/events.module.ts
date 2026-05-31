import { Module } from '@nestjs/common';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { MarketsModule } from '../markets/markets.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [CasinoGroupsModule, MarketsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
