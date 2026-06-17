import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { CasinoGroupsModule } from '../casino-groups/casino-groups.module';
import { DatabaseModule } from '../../shared/database/database.module';
import { EnvConfig } from '../../shared/config/env.validation';
import { WalletController } from './wallet.controller';
import { WalletHttpClient } from './wallet.client';
import { WALLET_PORT } from './wallet.port';
import { WalletOutboxService } from './wallet-outbox.service';
import { WalletService } from './wallet.service';
import { WalletStubClient } from './wallet-stub.client';

@Module({
  imports: [HttpModule, CasinoGroupsModule, AuthModule, DatabaseModule],
  controllers: [WalletController],
  providers: [
    WalletService,
    WalletOutboxService,
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
  exports: [WALLET_PORT, WalletService, WalletOutboxService],
})
export class WalletModule {}
