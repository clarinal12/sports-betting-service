import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketsModule } from '../markets/markets.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule, MarketsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
