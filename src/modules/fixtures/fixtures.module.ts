import { Module } from '@nestjs/common';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';

@Module({
  imports: [CasinoGroupsModule],
  controllers: [FixturesController],
  providers: [FixturesService],
})
export class FixturesModule {}
