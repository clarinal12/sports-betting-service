export interface NormalizedSport {
  key: string;
  name: string;
  slug: string;
}

export interface NormalizedLeague {
  key: string;
  sportKey: string;
  name: string;
  region?: string;
}

export interface NormalizedTeam {
  key: string;
  sportKey: string;
  name: string;
  shortName?: string;
}

export type NormalizedFixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'ENDED'
  | 'POSTPONED'
  | 'CANCELLED';

export interface NormalizedFixture {
  providerRef: string;
  leagueKey: string;
  homeTeamKey: string;
  awayTeamKey: string;
  startsAt: string;
  status: NormalizedFixtureStatus;
}

/**
 * Snapshot of catalog + schedule from an upstream provider, already mapped to
 * internal shapes. Adding a real provider (e.g. Sportradar) means implementing
 * this port; ingestion code stays unchanged.
 */
export interface ProviderSnapshot {
  sports: NormalizedSport[];
  leagues: NormalizedLeague[];
  teams: NormalizedTeam[];
  fixtures: NormalizedFixture[];
}

export interface FixtureProviderPort {
  fetchSnapshot(): Promise<ProviderSnapshot>;
}

export const FIXTURE_PROVIDER = Symbol('FIXTURE_PROVIDER');
