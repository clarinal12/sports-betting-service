import type { OddsApiSport } from './odds-api.types';

/**
 * Per-sport or per-group defaults. Use a group prefix key (e.g. `basketball`) to
 * apply settings to every `basketball_*` sport from the API.
 */
export interface OddsApiSportConfig {
  groupSportKey: string;
  /** `all`, comma-separated regions, or empty → fall back to ODDS_API_REGIONS. */
  region: string;
  /** Preferred bookmaker key; empty → first bookmaker returned. */
  bookmaker: string;
  leagueName: string;
  regionName: string;
}

export const ODDS_API_SPORT_CONFIG: Record<string, OddsApiSportConfig> = {
  basketball: {
    groupSportKey: 'basketball',
    region: 'all',
    bookmaker: '',
    leagueName: '',
    regionName: '',
  },
  baseball: {
    groupSportKey: 'baseball',
    region: 'all',
    bookmaker: '',
    leagueName: '',
    regionName: '',
  },
  americanfootball: {
    groupSportKey: 'americanfootball',
    region: 'all',
    bookmaker: '',
    leagueName: '',
    regionName: '',
  },
  soccer: {
    groupSportKey: 'soccer',
    region: 'all',
    bookmaker: '',
    leagueName: '',
    regionName: '',
  },
};

export const ODDS_API_MARKET_TYPE_MAP = {
  h2h: 'MATCH_RESULT',
  spreads: 'HANDICAP',
  totals: 'TOTAL',
} as const;

export type OddsApiMarketKey = keyof typeof ODDS_API_MARKET_TYPE_MAP;

/** Every region supported by The Odds API v4 `regions` parameter. */
export const ODDS_API_ALL_REGIONS = 'us,us2,uk,eu,au';

export function resolveRegions(configured: string): string {
  if (configured.trim().toLowerCase() === 'all') {
    return ODDS_API_ALL_REGIONS;
  }
  return configured;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

/**
 * Game-based sports only — outright/futures markets (e.g. championship winner)
 * use a different event shape and are skipped.
 */
export function isIngestibleSport(sport: OddsApiSport): boolean {
  return sport.active && !sport.has_outrights;
}

/** Resolve configured keys; `all` or group aliases like `basketball` expand via /sports. */
export function resolveSportKeys(
  configured: string[],
  apiSports: OddsApiSport[],
): string[] {
  const ingestible = apiSports.filter(isIngestibleSport);

  if (configured.length === 1 && configured[0] === 'all') {
    return ingestible.map((sport) => sport.key);
  }

  const resolved = new Set<string>();
  const activeKeys = new Set(ingestible.map((sport) => sport.key));

  for (const entry of configured) {
    if (entry === 'all') {
      continue;
    }
    if (activeKeys.has(entry)) {
      resolved.add(entry);
      continue;
    }
    const prefix = `${entry}_`;
    for (const sport of ingestible) {
      if (sport.key.startsWith(prefix)) {
        resolved.add(sport.key);
      }
    }
  }

  return [...resolved];
}

/** Match configured ingest keys against league keys already in the catalog (DB). */
export function resolveCatalogLeagueKeys(
  configured: string[],
  catalogLeagueKeys: string[],
): string[] {
  if (configured.length === 1 && configured[0] === 'all') {
    return [...catalogLeagueKeys];
  }

  const resolved = new Set<string>();
  const knownKeys = new Set(catalogLeagueKeys);

  for (const entry of configured) {
    if (entry === 'all') {
      continue;
    }
    if (knownKeys.has(entry)) {
      resolved.add(entry);
      continue;
    }
    const prefix = `${entry}_`;
    for (const key of catalogLeagueKeys) {
      if (key.startsWith(prefix)) {
        resolved.add(key);
      }
    }
  }

  return [...resolved];
}

export function resolveSportConfig(
  sportKey: string,
  apiSport?: OddsApiSport,
): OddsApiSportConfig {
  const exact = ODDS_API_SPORT_CONFIG[sportKey];
  if (exact) {
    return {
      ...exact,
      leagueName: exact.leagueName || apiSport?.title || sportKey,
    };
  }

  const groupKey = sportKey.split('_')[0] ?? sportKey;
  const group = ODDS_API_SPORT_CONFIG[groupKey];
  if (group && groupKey !== sportKey) {
    return {
      ...group,
      leagueName: apiSport?.title ?? sportKey,
    };
  }

  const groupSportKey = apiSport ? slugify(apiSport.group) : groupKey;

  return {
    groupSportKey,
    region: '',
    bookmaker: '',
    leagueName: apiSport?.title ?? sportKey,
    regionName: '',
  };
}
