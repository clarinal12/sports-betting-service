/** Fixture `providerRef` prefix for MockFixtureProvider rows. */
export const MOCK_FIXTURE_PROVIDER_PREFIX = 'mock_';

/** Team keys seeded only by the mock provider (safe to delete when unreferenced). */
export const MOCK_TEAM_KEYS = [
  'epl_ars',
  'epl_che',
  'epl_liv',
  'epl_mci',
  'laliga_rma',
  'laliga_fcb',
  'nba_lal',
  'nba_bos',
  'nba_gsw',
  'nba_mia',
] as const;
