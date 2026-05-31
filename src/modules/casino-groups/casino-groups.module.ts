import { Module } from '@nestjs/common';
import { CasinoGroupGuard } from './casino-group.guard';
import { CasinoGroupsService } from './casino-groups.service';

@Module({
  providers: [CasinoGroupsService, CasinoGroupGuard],
  exports: [CasinoGroupsService, CasinoGroupGuard],
})
export class CasinoGroupsModule {}
