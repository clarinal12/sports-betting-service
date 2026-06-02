import { Module } from '@nestjs/common';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { LaunchController } from './launch.controller';
import { OperatorTokenVerifier } from './operator-token.verifier';
import { PlayerAuthGuard } from './player-auth.guard';
import { SessionService } from './session.service';

@Module({
  imports: [CasinoGroupsModule],
  controllers: [LaunchController],
  providers: [OperatorTokenVerifier, SessionService, PlayerAuthGuard],
  // Re-export CasinoGroupsModule so modules that apply PlayerAuthGuard (which
  // depends on CasinoGroupsService) get it in scope by importing AuthModule.
  exports: [SessionService, PlayerAuthGuard, CasinoGroupsModule],
})
export class AuthModule {}
