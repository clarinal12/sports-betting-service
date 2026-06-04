import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { BetValidationService } from './bet-validation.service';
import { BetsOutboxWorker } from './bets-outbox.worker';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [BetsController],
  providers: [BetValidationService, BetsService, BetsOutboxWorker],
  exports: [BetsService],
})
export class BetsModule {}
