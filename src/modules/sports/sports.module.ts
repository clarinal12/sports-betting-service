import { Module } from '@nestjs/common';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { SportsController } from './sports.controller';
import { SportsService } from './sports.service';

@Module({
  imports: [CasinoGroupsModule],
  controllers: [SportsController],
  providers: [SportsService],
})
export class SportsModule {}
