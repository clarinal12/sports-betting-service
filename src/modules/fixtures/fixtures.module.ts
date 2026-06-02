import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';

@Module({
  imports: [AuthModule],
  controllers: [FixturesController],
  providers: [FixturesService],
})
export class FixturesModule {}
