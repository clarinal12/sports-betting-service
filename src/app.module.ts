import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './shared/config/config.module';
import { CacheModule } from './shared/cache/cache.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { RootModule } from './modules/root/root.module';
import { CasinoGroupsModule } from './modules/casino-groups/casino-groups.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { SportsModule } from './modules/sports/sports.module';
import { LeaguesModule } from './modules/leagues/leagues.module';
import { FixturesModule } from './modules/fixtures/fixtures.module';
import { EventsModule } from './modules/events/events.module';
import { MarketsModule } from './modules/markets/markets.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { BetsModule } from './modules/bets/bets.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AuditModule } from './shared/audit/audit.module';
import { MetricsModule } from './shared/metrics/metrics.module';

@Module({
  imports: [
    AppConfigModule,
    MetricsModule,
    AuditModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    DatabaseModule,
    CacheModule,
    CryptoModule,
    HealthModule,
    RootModule,
    CasinoGroupsModule,
    AuthModule,
    WalletModule,
    ProvidersModule,
    IngestionModule,
    SportsModule,
    LeaguesModule,
    FixturesModule,
    EventsModule,
    MarketsModule,
    RealtimeModule,
    BetsModule,
    SettlementModule,
  ],
})
export class AppModule {}
