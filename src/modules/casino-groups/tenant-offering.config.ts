/** League key prefixes offered per demo casino group (Odds API sport keys). */

export const ACME_LEAGUE_PREFIXES = [
  'basketball',
  'baseball',
  'americanfootball',
  'soccer',
] as const;

export const BETZONE_LEAGUE_PREFIXES = ['basketball'] as const;

/** Ingest scope for acme / seed when using the Odds API provider. */
export const ACME_INGEST_SPORT_KEYS =
  'basketball,baseball,americanfootball,soccer';

export function isLeagueOffered(
  leagueKey: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) => leagueKey.startsWith(`${prefix}_`));
}
