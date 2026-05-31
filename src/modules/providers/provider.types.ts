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

export type NormalizedEventStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'SUSPENDED'
  | 'ENDED'
  | 'CANCELLED';

export interface NormalizedEvent {
  providerRef: string;
  fixtureProviderRef: string;
  status: NormalizedEventStatus;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  clock?: string;
}

export type NormalizedMarketType =
  | 'MATCH_RESULT'
  | 'HANDICAP'
  | 'TOTAL'
  | 'DOUBLE_CHANCE'
  | 'BOTH_TEAMS_SCORE';

export type NormalizedMarketStatus = 'OPEN' | 'SUSPENDED' | 'SETTLED' | 'VOID';

export interface NormalizedMarket {
  providerRef: string;
  eventProviderRef: string;
  type: NormalizedMarketType;
  status: NormalizedMarketStatus;
  /** Handicap/total line as a string to preserve decimal precision. */
  line?: string;
}

export type NormalizedSelectionStatus =
  | 'OPEN'
  | 'SUSPENDED'
  | 'SETTLED'
  | 'VOID';

export interface NormalizedSelection {
  providerRef: string;
  marketProviderRef: string;
  name: string;
  status: NormalizedSelectionStatus;
  /** Decimal odds as a string to preserve precision (never a JS number). */
  price: string;
}

/**
 * Snapshot of catalog + schedule + live state from an upstream provider,
 * already mapped to internal shapes. Adding a real provider (e.g. Sportradar)
 * means implementing this port; ingestion code stays unchanged.
 */
export interface ProviderSnapshot {
  sports: NormalizedSport[];
  leagues: NormalizedLeague[];
  teams: NormalizedTeam[];
  fixtures: NormalizedFixture[];
  events: NormalizedEvent[];
  markets: NormalizedMarket[];
  selections: NormalizedSelection[];
}

export interface FixtureProviderPort {
  fetchSnapshot(): Promise<ProviderSnapshot>;
}

export const FIXTURE_PROVIDER = Symbol('FIXTURE_PROVIDER');
