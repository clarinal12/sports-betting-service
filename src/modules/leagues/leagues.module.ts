import { Module } from '@nestjs/common';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';

@Module({
  imports: [CasinoGroupsModule],
  controllers: [LeaguesController],
  providers: [LeaguesService],
})
export class LeaguesModule {}
