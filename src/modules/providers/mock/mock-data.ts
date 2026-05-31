import { ProviderSnapshot } from '../provider.types';

const DAY = 24 * 60 * 60 * 1000;

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/**
 * Static fixtures for local development. Kick-off times are relative to "now"
 * so the schedule always contains upcoming events without re-seeding.
 */
export const mockSnapshot: ProviderSnapshot = {
  sports: [
    { key: 'soccer', name: 'Soccer', slug: 'soccer' },
    { key: 'basketball', name: 'Basketball', slug: 'basketball' },
  ],
  leagues: [
    {
      key: 'soccer_epl',
      sportKey: 'soccer',
      name: 'Premier League',
      region: 'England',
    },
    {
      key: 'soccer_laliga',
      sportKey: 'soccer',
      name: 'La Liga',
      region: 'Spain',
    },
    {
      key: 'basketball_nba',
      sportKey: 'basketball',
      name: 'NBA',
      region: 'USA',
    },
  ],
  teams: [
    { key: 'epl_ars', sportKey: 'soccer', name: 'Arsenal', shortName: 'ARS' },
    { key: 'epl_che', sportKey: 'soccer', name: 'Chelsea', shortName: 'CHE' },
    { key: 'epl_liv', sportKey: 'soccer', name: 'Liverpool', shortName: 'LIV' },
    {
      key: 'epl_mci',
      sportKey: 'soccer',
      name: 'Manchester City',
      shortName: 'MCI',
    },
    {
      key: 'laliga_rma',
      sportKey: 'soccer',
      name: 'Real Madrid',
      shortName: 'RMA',
    },
    {
      key: 'laliga_fcb',
      sportKey: 'soccer',
      name: 'Barcelona',
      shortName: 'FCB',
    },
    {
      key: 'nba_lal',
      sportKey: 'basketball',
      name: 'Los Angeles Lakers',
      shortName: 'LAL',
    },
    {
      key: 'nba_bos',
      sportKey: 'basketball',
      name: 'Boston Celtics',
      shortName: 'BOS',
    },
    {
      key: 'nba_gsw',
      sportKey: 'basketball',
      name: 'Golden State Warriors',
      shortName: 'GSW',
    },
    {
      key: 'nba_mia',
      sportKey: 'basketball',
      name: 'Miami Heat',
      shortName: 'MIA',
    },
  ],
  fixtures: [
    {
      providerRef: 'mock_epl_1',
      leagueKey: 'soccer_epl',
      homeTeamKey: 'epl_ars',
      awayTeamKey: 'epl_che',
      startsAt: isoFromNow(1 * DAY),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_epl_2',
      leagueKey: 'soccer_epl',
      homeTeamKey: 'epl_liv',
      awayTeamKey: 'epl_mci',
      startsAt: isoFromNow(2 * DAY),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_epl_3',
      leagueKey: 'soccer_epl',
      homeTeamKey: 'epl_che',
      awayTeamKey: 'epl_liv',
      startsAt: isoFromNow(3 * DAY),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_laliga_1',
      leagueKey: 'soccer_laliga',
      homeTeamKey: 'laliga_rma',
      awayTeamKey: 'laliga_fcb',
      startsAt: isoFromNow(1 * DAY + 3600000),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_laliga_2',
      leagueKey: 'soccer_laliga',
      homeTeamKey: 'laliga_fcb',
      awayTeamKey: 'laliga_rma',
      startsAt: isoFromNow(4 * DAY),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_nba_1',
      leagueKey: 'basketball_nba',
      homeTeamKey: 'nba_lal',
      awayTeamKey: 'nba_bos',
      startsAt: isoFromNow(12 * 3600000),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_nba_2',
      leagueKey: 'basketball_nba',
      homeTeamKey: 'nba_gsw',
      awayTeamKey: 'nba_mia',
      startsAt: isoFromNow(1 * DAY + 7200000),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_nba_3',
      leagueKey: 'basketball_nba',
      homeTeamKey: 'nba_bos',
      awayTeamKey: 'nba_gsw',
      startsAt: isoFromNow(2 * DAY + 7200000),
      status: 'SCHEDULED',
    },
    {
      providerRef: 'mock_nba_4',
      leagueKey: 'basketball_nba',
      homeTeamKey: 'nba_mia',
      awayTeamKey: 'nba_lal',
      startsAt: isoFromNow(-2 * 3600000),
      status: 'LIVE',
    },
    {
      providerRef: 'mock_nba_5',
      leagueKey: 'basketball_nba',
      homeTeamKey: 'nba_lal',
      awayTeamKey: 'nba_gsw',
      startsAt: isoFromNow(-2 * DAY),
      status: 'ENDED',
    },
  ],
};
