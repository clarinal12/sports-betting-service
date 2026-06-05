import {
  ACME_LEAGUE_PREFIXES,
  BETZONE_LEAGUE_PREFIXES,
  isLeagueOffered,
} from './tenant-offering.config';

describe('tenant-offering.config', () => {
  it('acme offers NBA only', () => {
    expect(isLeagueOffered('basketball_nba', ACME_LEAGUE_PREFIXES)).toBe(true);
    expect(isLeagueOffered('basketball_wnba', ACME_LEAGUE_PREFIXES)).toBe(false);
    expect(isLeagueOffered('baseball_mlb', ACME_LEAGUE_PREFIXES)).toBe(false);
    expect(isLeagueOffered('soccer_epl', ACME_LEAGUE_PREFIXES)).toBe(false);
  });

  it('betzone offers NBA only', () => {
    expect(isLeagueOffered('basketball_nba', BETZONE_LEAGUE_PREFIXES)).toBe(true);
    expect(isLeagueOffered('basketball_wnba', BETZONE_LEAGUE_PREFIXES)).toBe(
      false,
    );
    expect(isLeagueOffered('soccer_epl', BETZONE_LEAGUE_PREFIXES)).toBe(false);
  });
});
