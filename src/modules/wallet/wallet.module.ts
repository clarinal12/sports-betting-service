import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { EnvConfig } from '../../shared/config/env.validation';
import { WalletHttpClient } from './wallet.client';
import { WALLET_PORT } from './wallet.port';
import { WalletStubClient } from './wallet-stub.client';

@Module({
  imports: [HttpModule, CasinoGroupsModule],
  providers: [
    WalletStubClient,
    WalletHttpClient,
    {
      provide: WALLET_PORT,
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        stub: WalletStubClient,
        http: WalletHttpClient,
      ) => {
        const mode = config.get('WALLET_PROVIDER', { infer: true });
        if (mode === 'http') {
          return http;
        }
        return stub;
      },
      inject: [ConfigService, WalletStubClient, WalletHttpClient],
    },
  ],
  exports: [WALLET_PORT],
})
export class WalletModule {}
