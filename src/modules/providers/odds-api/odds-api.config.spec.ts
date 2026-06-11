import {
  isIngestibleSport,
  ODDS_API_ALL_REGIONS,
  resolveRegions,
  resolveSportConfig,
  resolveSportKeys,
  resolveCatalogLeagueKeys,
} from './odds-api.config';
import type { OddsApiSport } from './odds-api.types';

describe('odds-api.config', () => {
  const apiSports: OddsApiSport[] = [
    {
      key: 'soccer_epl',
      group: 'Soccer',
      title: 'EPL',
      description: '',
      active: true,
      has_outrights: false,
    },
    {
      key: 'basketball_nba',
      group: 'Basketball',
      title: 'NBA',
      description: '',
      active: true,
      has_outrights: false,
    },
    {
      key: 'basketball_wnba',
      group: 'Basketball',
      title: 'WNBA',
      description: '',
      active: true,
      has_outrights: false,
    },
    {
      key: 'golf_masters_tournament_winner',
      group: 'Golf',
      title: 'Masters Winner',
      description: '',
      active: true,
      has_outrights: true,
    },
    {
      key: 'cricket_test_match',
      group: 'Cricket',
      title: 'Test Matches',
      description: '',
      active: true,
      has_outrights: false,
    },
    {
      key: 'soccer_laliga',
      group: 'Soccer',
      title: 'La Liga',
      description: '',
      active: false,
      has_outrights: false,
    },
  ];

  it('resolveRegions all expands to every API region', () => {
    expect(resolveRegions('all')).toBe(ODDS_API_ALL_REGIONS);
    expect(resolveRegions('us,uk')).toBe('us,uk');
  });

  it('resolveSportKeys all returns active game sports only', () => {
    expect(resolveSportKeys(['all'], apiSports)).toEqual([
      'soccer_epl',
      'basketball_nba',
      'basketball_wnba',
      'cricket_test_match',
    ]);
  });

  it('resolveSportKeys basketball expands to all active basketball_* leagues', () => {
    expect(resolveSportKeys(['basketball'], apiSports)).toEqual([
      'basketball_nba',
      'basketball_wnba',
    ]);
  });

  it('resolveSportKeys acme offering expands four sport families', () => {
    const sports: OddsApiSport[] = [
      {
        key: 'soccer_epl',
        group: 'Soccer',
        title: 'EPL',
        description: '',
        active: true,
        has_outrights: false,
      },
      {
        key: 'basketball_nba',
        group: 'Basketball',
        title: 'NBA',
        description: '',
        active: true,
        has_outrights: false,
      },
      {
        key: 'basketball_wnba',
        group: 'Basketball',
        title: 'WNBA',
        description: '',
        active: true,
        has_outrights: false,
      },
      {
        key: 'baseball_mlb',
        group: 'Baseball',
        title: 'MLB',
        description: '',
        active: true,
        has_outrights: false,
      },
      {
        key: 'americanfootball_nfl',
        group: 'American Football',
        title: 'NFL',
        description: '',
        active: true,
        has_outrights: false,
      },
      {
        key: 'icehockey_nhl',
        group: 'Ice Hockey',
        title: 'NHL',
        description: '',
        active: true,
        has_outrights: false,
      },
    ];
    expect(
      resolveSportKeys(
        ['basketball', 'baseball', 'americanfootball', 'soccer'],
        sports,
      ),
    ).toEqual([
      'basketball_nba',
      'basketball_wnba',
      'baseball_mlb',
      'americanfootball_nfl',
      'soccer_epl',
    ]);
  });

  it('resolveSportConfig uses basketball group for all basketball_* sports', () => {
    expect(resolveSportConfig('basketball_nba', apiSports[1])).toMatchObject({
      groupSportKey: 'basketball',
      region: 'all',
      bookmaker: '',
      leagueName: 'NBA',
    });
    expect(resolveSportConfig('basketball_wnba', apiSports[2])).toMatchObject({
      groupSportKey: 'basketball',
      region: 'all',
      leagueName: 'WNBA',
    });
  });

  it('resolveSportConfig uses API group for unknown sports', () => {
    expect(
      resolveSportConfig('cricket_test_match', apiSports[4]).groupSportKey,
    ).toBe('cricket');
  });

  it('resolveCatalogLeagueKeys filters DB leagues by configured ingest scope', () => {
    const catalog = [
      'soccer_epl',
      'soccer_laliga',
      'basketball_nba',
      'basketball_wnba',
    ];

    expect(resolveCatalogLeagueKeys(['basketball_nba'], catalog)).toEqual([
      'basketball_nba',
    ]);
    expect(resolveCatalogLeagueKeys(['basketball'], catalog)).toEqual([
      'basketball_nba',
      'basketball_wnba',
    ]);
    expect(resolveCatalogLeagueKeys(['all'], catalog)).toEqual(catalog);
  });
});
