import { Module } from '@nestjs/common';
import { FIXTURE_PROVIDER } from './provider.types';
import { MockFixtureProvider } from './mock/mock-fixture.provider';

@Module({
  providers: [{ provide: FIXTURE_PROVIDER, useClass: MockFixtureProvider }],
  exports: [FIXTURE_PROVIDER],
})
export class ProvidersModule {}
