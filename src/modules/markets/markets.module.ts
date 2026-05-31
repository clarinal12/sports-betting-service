import { Module } from '@nestjs/common';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';

@Module({
  imports: [CasinoGroupsModule],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
