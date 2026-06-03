import {
  ACME_LEAGUE_PREFIXES,
  BETZONE_LEAGUE_PREFIXES,
  isLeagueOffered,
} from './tenant-offering.config';

describe('tenant-offering.config', () => {
  it('acme allows four sport families', () => {
    expect(isLeagueOffered('basketball_nba', ACME_LEAGUE_PREFIXES)).toBe(true);
    expect(isLeagueOffered('baseball_mlb', ACME_LEAGUE_PREFIXES)).toBe(true);
    expect(isLeagueOffered('americanfootball_nfl', ACME_LEAGUE_PREFIXES)).toBe(
      true,
    );
    expect(isLeagueOffered('soccer_epl', ACME_LEAGUE_PREFIXES)).toBe(true);
    expect(isLeagueOffered('icehockey_nhl', ACME_LEAGUE_PREFIXES)).toBe(false);
  });

  it('betzone allows basketball only', () => {
    expect(isLeagueOffered('basketball_wnba', BETZONE_LEAGUE_PREFIXES)).toBe(
      true,
    );
    expect(isLeagueOffered('soccer_epl', BETZONE_LEAGUE_PREFIXES)).toBe(false);
  });
});
