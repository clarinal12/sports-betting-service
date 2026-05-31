import {
  NormalizedEvent,
  NormalizedFixture,
  NormalizedMarket,
  NormalizedSelection,
  ProviderSnapshot,
} from '../provider.types';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const sports = [
  { key: 'soccer', name: 'Soccer', slug: 'soccer' },
  { key: 'basketball', name: 'Basketball', slug: 'basketball' },
];

const leagues = [
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
  { key: 'basketball_nba', sportKey: 'basketball', name: 'NBA', region: 'USA' },
];

const teams = [
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
];

interface MockFixtureSpec extends NormalizedFixture {
  sportKey: 'soccer' | 'basketball';
}

const fixtureSpecs: MockFixtureSpec[] = [
  {
    providerRef: 'mock_epl_1',
    sportKey: 'soccer',
    leagueKey: 'soccer_epl',
    homeTeamKey: 'epl_ars',
    awayTeamKey: 'epl_che',
    startsAt: isoFromNow(1 * DAY),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_epl_2',
    sportKey: 'soccer',
    leagueKey: 'soccer_epl',
    homeTeamKey: 'epl_liv',
    awayTeamKey: 'epl_mci',
    startsAt: isoFromNow(2 * DAY),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_epl_3',
    sportKey: 'soccer',
    leagueKey: 'soccer_epl',
    homeTeamKey: 'epl_che',
    awayTeamKey: 'epl_liv',
    startsAt: isoFromNow(-1 * HOUR),
    status: 'LIVE',
  },
  {
    providerRef: 'mock_laliga_1',
    sportKey: 'soccer',
    leagueKey: 'soccer_laliga',
    homeTeamKey: 'laliga_rma',
    awayTeamKey: 'laliga_fcb',
    startsAt: isoFromNow(1 * DAY + HOUR),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_laliga_2',
    sportKey: 'soccer',
    leagueKey: 'soccer_laliga',
    homeTeamKey: 'laliga_fcb',
    awayTeamKey: 'laliga_rma',
    startsAt: isoFromNow(4 * DAY),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_nba_1',
    sportKey: 'basketball',
    leagueKey: 'basketball_nba',
    homeTeamKey: 'nba_lal',
    awayTeamKey: 'nba_bos',
    startsAt: isoFromNow(12 * HOUR),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_nba_2',
    sportKey: 'basketball',
    leagueKey: 'basketball_nba',
    homeTeamKey: 'nba_gsw',
    awayTeamKey: 'nba_mia',
    startsAt: isoFromNow(1 * DAY + 2 * HOUR),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_nba_3',
    sportKey: 'basketball',
    leagueKey: 'basketball_nba',
    homeTeamKey: 'nba_bos',
    awayTeamKey: 'nba_gsw',
    startsAt: isoFromNow(2 * DAY + 2 * HOUR),
    status: 'SCHEDULED',
  },
  {
    providerRef: 'mock_nba_4',
    sportKey: 'basketball',
    leagueKey: 'basketball_nba',
    homeTeamKey: 'nba_mia',
    awayTeamKey: 'nba_lal',
    startsAt: isoFromNow(-2 * HOUR),
    status: 'LIVE',
  },
  {
    providerRef: 'mock_nba_5',
    sportKey: 'basketball',
    leagueKey: 'basketball_nba',
    homeTeamKey: 'nba_lal',
    awayTeamKey: 'nba_gsw',
    startsAt: isoFromNow(-2 * DAY),
    status: 'ENDED',
  },
];

const teamName = (key: string): string =>
  teams.find((t) => t.key === key)?.name ?? key;

/**
 * Builds events + markets + selections for each fixture. Market menu depends on
 * sport; scheduled/live events have OPEN markets, ended events are SETTLED.
 */
function buildLiveData(): {
  events: NormalizedEvent[];
  markets: NormalizedMarket[];
  selections: NormalizedSelection[];
} {
  const events: NormalizedEvent[] = [];
  const markets: NormalizedMarket[] = [];
  const selections: NormalizedSelection[] = [];

  for (const fixture of fixtureSpecs) {
    const eventRef = `evt_${fixture.providerRef}`;
    const isEnded = fixture.status === 'ENDED';
    const isLive = fixture.status === 'LIVE';

    events.push({
      providerRef: eventRef,
      fixtureProviderRef: fixture.providerRef,
      status: isEnded ? 'ENDED' : isLive ? 'LIVE' : 'SCHEDULED',
      homeScore: isLive ? 1 : isEnded ? 2 : undefined,
      awayScore: isLive ? 0 : isEnded ? 3 : undefined,
      period: isLive
        ? fixture.sportKey === 'soccer'
          ? '1H'
          : 'Q2'
        : undefined,
      clock: isLive ? "24'" : undefined,
    });

    const marketStatus = isEnded ? 'SETTLED' : 'OPEN';
    const selectionStatus = isEnded ? 'SETTLED' : 'OPEN';
    const home = teamName(fixture.homeTeamKey);
    const away = teamName(fixture.awayTeamKey);

    const pushMarket = (
      typeKey: string,
      type: NormalizedMarket['type'],
      line: string | undefined,
      outcomes: { name: string; price: string }[],
    ): void => {
      const marketRef = `mkt_${fixture.providerRef}_${typeKey}`;
      markets.push({
        providerRef: marketRef,
        eventProviderRef: eventRef,
        type,
        status: marketStatus,
        line,
      });
      outcomes.forEach((outcome, idx) => {
        selections.push({
          providerRef: `sel_${fixture.providerRef}_${typeKey}_${idx}`,
          marketProviderRef: marketRef,
          name: outcome.name,
          status: selectionStatus,
          price: outcome.price,
        });
      });
    };

    if (fixture.sportKey === 'soccer') {
      pushMarket('1x2', 'MATCH_RESULT', undefined, [
        { name: home, price: '2.10' },
        { name: 'Draw', price: '3.30' },
        { name: away, price: '3.50' },
      ]);
      pushMarket('total25', 'TOTAL', '2.50', [
        { name: 'Over', price: '1.90' },
        { name: 'Under', price: '1.90' },
      ]);
      pushMarket('btts', 'BOTH_TEAMS_SCORE', undefined, [
        { name: 'Yes', price: '1.72' },
        { name: 'No', price: '2.05' },
      ]);
    } else {
      pushMarket('ml', 'MATCH_RESULT', undefined, [
        { name: home, price: '1.55' },
        { name: away, price: '2.45' },
      ]);
      pushMarket('hcap', 'HANDICAP', '-4.50', [
        { name: `${home} -4.5`, price: '1.90' },
        { name: `${away} +4.5`, price: '1.90' },
      ]);
      pushMarket('total', 'TOTAL', '218.50', [
        { name: 'Over', price: '1.87' },
        { name: 'Under', price: '1.93' },
      ]);
    }
  }

  return { events, markets, selections };
}

const liveData = buildLiveData();

/**
 * Static catalog + schedule + live state for local development. Kick-off times
 * are relative to "now" so the schedule always contains upcoming events.
 */
export const mockSnapshot: ProviderSnapshot = {
  sports,
  leagues,
  teams,
  fixtures: fixtureSpecs.map((spec) => ({
    providerRef: spec.providerRef,
    leagueKey: spec.leagueKey,
    homeTeamKey: spec.homeTeamKey,
    awayTeamKey: spec.awayTeamKey,
    startsAt: spec.startsAt,
    status: spec.status,
  })),
  events: liveData.events,
  markets: liveData.markets,
  selections: liveData.selections,
};
