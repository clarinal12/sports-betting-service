/** League keys offered per demo casino group (exact Odds API league keys). */

export const NBA_LEAGUE_KEY = 'basketball_nba' as const;

export const ACME_LEAGUE_PREFIXES = [NBA_LEAGUE_KEY] as const;

export const BETZONE_LEAGUE_PREFIXES = [NBA_LEAGUE_KEY] as const;

/** Ingest scope for seed / catalog when using the Odds API provider. */
export const ACME_INGEST_SPORT_KEYS = NBA_LEAGUE_KEY;

export function isLeagueOffered(
  leagueKey: string,
  offeredLeagueKeys: readonly string[],
): boolean {
  return offeredLeagueKeys.includes(leagueKey);
}
