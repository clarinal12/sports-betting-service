import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WalletClient } from './wallet.client';
import { WALLET_PORT } from './wallet.port';

@Module({
  imports: [HttpModule],
  providers: [{ provide: WALLET_PORT, useClass: WalletClient }, WalletClient],
  exports: [WALLET_PORT],
})
export class WalletModule {}
