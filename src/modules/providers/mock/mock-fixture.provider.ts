import { Injectable } from '@nestjs/common';
import { FixtureProviderPort, ProviderSnapshot } from '../provider.types';
import { mockSnapshot } from './mock-data';

@Injectable()
export class MockFixtureProvider implements FixtureProviderPort {
  fetchSnapshot(): Promise<ProviderSnapshot> {
    return Promise.resolve(mockSnapshot);
  }
}
