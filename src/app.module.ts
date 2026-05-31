import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './shared/config/config.module';
import { CacheModule } from './shared/cache/cache.module';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { RootModule } from './modules/root/root.module';
import { CasinoGroupsModule } from './modules/casino-groups/casino-groups.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { SportsModule } from './modules/sports/sports.module';
import { LeaguesModule } from './modules/leagues/leagues.module';
import { FixturesModule } from './modules/fixtures/fixtures.module';

@Module({
  imports: [
    AppConfigModule,
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
    HealthModule,
    RootModule,
    CasinoGroupsModule,
    ProvidersModule,
    IngestionModule,
    SportsModule,
    LeaguesModule,
    FixturesModule,
  ],
})
export class AppModule {}
