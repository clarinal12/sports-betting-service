import { mapOddsApiToSnapshot } from './odds-api.mapper';
import type { OddsApiEventOdds } from './odds-api.types';

const eplOdds: OddsApiEventOdds[] = [
  {
    id: 'abc123epl',
    sport_key: 'soccer_epl',
    sport_title: 'EPL',
    commence_time: '2026-06-15T15:00:00Z',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    bookmakers: [
      {
        key: 'bet365',
        title: 'Bet365',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Arsenal', price: 2.1 },
              { name: 'Chelsea', price: 3.4 },
              { name: 'Draw', price: 3.2 },
            ],
          },
          {
            key: 'totals',
            outcomes: [
              { name: 'Over', price: 1.9, point: 2.5 },
              { name: 'Under', price: 1.95, point: 2.5 },
            ],
          },
        ],
      },
      {
        key: 'williamhill',
        title: 'William Hill',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Arsenal', price: 2.0 },
              { name: 'Chelsea', price: 3.5 },
              { name: 'Draw', price: 3.3 },
            ],
          },
        ],
      },
    ],
  },
];

describe('mapOddsApiToSnapshot', () => {
  it('maps EPL odds with bet365 preference and decimal prices as strings', () => {
    const snapshot = mapOddsApiToSnapshot({
      sportKeys: ['soccer_epl'],
      apiSports: [
        {
          key: 'soccer_epl',
          group: 'Soccer',
          title: 'EPL',
          description: '',
          active: true,
          has_outrights: false,
        },
      ],
      oddsBySport: new Map([['soccer_epl', eplOdds]]),
      scoresBySport: new Map(),
      marketKeys: ['h2h', 'totals'],
    });

    expect(snapshot.sports).toEqual([
      { key: 'soccer', name: 'Soccer', slug: 'soccer' },
    ]);
    expect(snapshot.leagues).toEqual([
      {
        key: 'soccer_epl',
        sportKey: 'soccer',
        name: 'EPL',
        region: undefined,
      },
    ]);
    expect(snapshot.teams.map((t) => t.key).sort()).toEqual([
      'soccer_epl_arsenal',
      'soccer_epl_chelsea',
    ]);
    expect(snapshot.fixtures).toHaveLength(1);
    expect(snapshot.fixtures[0]?.status).toBe('SCHEDULED');

    const matchResult = snapshot.markets.find((m) => m.type === 'MATCH_RESULT');
    expect(matchResult?.providerRef).toBe('abc123epl:bet365:h2h');

    const homeWin = snapshot.selections.find((s) => s.name === 'Arsenal');
    expect(homeWin?.price).toBe('2.1');

    const over = snapshot.selections.find((s) => s.name === 'Over 2.5');
    expect(over?.price).toBe('1.9');
    expect(
      snapshot.selections.some((s) => s.providerRef.includes('williamhill')),
    ).toBe(false);
  });

  it('merges live scores into events', () => {
    const snapshot = mapOddsApiToSnapshot({
      sportKeys: ['soccer_epl'],
      apiSports: [],
      oddsBySport: new Map([
        [
          'soccer_epl',
          [
            {
              ...eplOdds[0]!,
              commence_time: '2026-06-01T12:00:00Z',
            },
          ],
        ],
      ]),
      scoresBySport: new Map([
        [
          'soccer_epl',
          [
            {
              id: 'abc123epl',
              sport_key: 'soccer_epl',
              sport_title: 'EPL',
              commence_time: '2026-06-01T12:00:00Z',
              completed: false,
              home_team: 'Arsenal',
              away_team: 'Chelsea',
              scores: [
                { name: 'Arsenal', score: '1' },
                { name: 'Chelsea', score: '0' },
              ],
            },
          ],
        ],
      ]),
      marketKeys: ['h2h'],
    });

    expect(snapshot.events[0]).toMatchObject({
      status: 'LIVE',
      homeScore: 1,
      awayScore: 0,
    });
    expect(snapshot.fixtures[0]?.status).toBe('LIVE');
  });

  it('marks fixture LIVE after kickoff when scores array is missing', () => {
    const snapshot = mapOddsApiToSnapshot({
      sportKeys: ['soccer_epl'],
      apiSports: [],
      oddsBySport: new Map([
        [
          'soccer_epl',
          [
            {
              ...eplOdds[0]!,
              commence_time: '2020-01-01T12:00:00Z',
            },
          ],
        ],
      ]),
      scoresBySport: new Map([
        [
          'soccer_epl',
          [
            {
              id: 'abc123epl',
              sport_key: 'soccer_epl',
              sport_title: 'EPL',
              commence_time: '2020-01-01T12:00:00Z',
              completed: false,
              home_team: 'Arsenal',
              away_team: 'Chelsea',
              scores: null,
              last_update: null,
            },
          ],
        ],
      ]),
      marketKeys: ['h2h'],
    });

    expect(snapshot.fixtures[0]?.status).toBe('LIVE');
    expect(snapshot.events[0]?.status).toBe('LIVE');
  });
});
