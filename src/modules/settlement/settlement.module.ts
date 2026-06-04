import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { LegOutcomeService } from './leg-outcome.service';
import { SettlementService } from './settlement.service';
import { SettlementWorker } from './settlement.worker';

@Module({
  imports: [WalletModule],
  providers: [LegOutcomeService, SettlementService, SettlementWorker],
  exports: [SettlementService],
})
export class SettlementModule {}
