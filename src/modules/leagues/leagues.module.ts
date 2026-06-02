import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';

@Module({
  imports: [AuthModule],
  controllers: [LeaguesController],
  providers: [LeaguesService],
})
export class LeaguesModule {}
