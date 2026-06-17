import { MarketType } from '@prisma/client';
import {
  buildLegSettlementInput,
  hasLegSnapshot,
  legSnapshotCreateData,
} from './bet-leg-snapshot';

describe('bet-leg-snapshot', () => {
  const snapshot = {
    marketType: MarketType.MATCH_RESULT,
    marketLine: null,
    homeTeamName: 'Home FC',
    awayTeamName: 'Away FC',
    eventProviderRef: 'evt_123',
    sportKey: 'basketball',
    sportName: 'Basketball',
    leagueKey: 'basketball_nba',
    leagueName: 'NBA',
  };

  it('hasLegSnapshot is false when snapshot columns are null', () => {
    expect(
      hasLegSnapshot({
        marketType: null,
        homeTeamName: null,
        awayTeamName: null,
      }),
    ).toBe(false);
  });

  it('buildLegSettlementInput uses frozen team names and market type', () => {
    const input = buildLegSettlementInput(
      { selectionName: 'Home FC' },
      snapshot,
      {
        marketStatus: 'SETTLED',
        eventStatus: 'ENDED',
        homeScore: 2,
        awayScore: 1,
      },
    );
    expect(input).toMatchObject({
      marketType: MarketType.MATCH_RESULT,
      homeTeamName: 'Home FC',
      awayTeamName: 'Away FC',
      homeScore: 2,
      awayScore: 1,
    });
  });

  it('legSnapshotCreateData maps line decimal', () => {
    const data = legSnapshotCreateData({
      ...snapshot,
      marketLine: '2.50',
    });
    expect(data.marketLine?.toFixed(2)).toBe('2.50');
    expect(data.eventProviderRef).toBe('evt_123');
  });
});
