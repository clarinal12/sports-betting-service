import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SportsController } from './sports.controller';
import { SportsService } from './sports.service';

@Module({
  imports: [AuthModule],
  controllers: [SportsController],
  providers: [SportsService],
})
export class SportsModule {}
