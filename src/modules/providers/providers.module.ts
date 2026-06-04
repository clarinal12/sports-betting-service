import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../shared/config/env.validation';
import { IngestionSupportModule } from '../ingestion/ingestion-support.module';
import { FIXTURE_PROVIDER } from './provider.types';
import { MockFixtureProvider } from './mock/mock-fixture.provider';
import { OddsApiProvider } from './odds-api/odds-api.provider';

@Module({
  imports: [HttpModule, IngestionSupportModule],
  providers: [
    MockFixtureProvider,
    OddsApiProvider,
    {
      provide: FIXTURE_PROVIDER,
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        mock: MockFixtureProvider,
        oddsApi: OddsApiProvider,
      ) =>
        config.get('FIXTURE_PROVIDER', { infer: true }) === 'odds-api'
          ? oddsApi
          : mock,
      inject: [ConfigService, MockFixtureProvider, OddsApiProvider],
    },
  ],
  exports: [FIXTURE_PROVIDER, OddsApiProvider],
})
export class ProvidersModule {}
