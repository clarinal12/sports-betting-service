import { Injectable } from '@nestjs/common';
import {
  EMPTY_PROVIDER_SNAPSHOT,
  FixtureProviderPort,
  LiveIngestScope,
  ProviderSnapshot,
} from '../provider.types';
import { buildMockLiveSnapshot, mockSnapshot } from './mock-data';

@Injectable()
export class MockFixtureProvider implements FixtureProviderPort {
  fetchSnapshot(): Promise<ProviderSnapshot> {
    return Promise.resolve(mockSnapshot);
  }

  fetchLiveSnapshot(scope: LiveIngestScope): Promise<ProviderSnapshot> {
    if (scope.sportKeys.length === 0) {
      return Promise.resolve(EMPTY_PROVIDER_SNAPSHOT);
    }
    return Promise.resolve(buildMockLiveSnapshot(scope));
  }
}
