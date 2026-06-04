import { MarketType } from '@prisma/client';
import { LegOutcomeService, LegSettlementInput } from './leg-outcome.service';

describe('LegOutcomeService', () => {
  const service = new LegOutcomeService();

  const base: LegSettlementInput = {
    marketType: MarketType.MATCH_RESULT,
    marketStatus: 'SETTLED',
    marketLine: null,
    selectionName: '',
    homeTeamName: 'Los Angeles Lakers',
    awayTeamName: 'Golden State Warriors',
    homeScore: 2,
    awayScore: 3,
  };

  it('grades match result away win', () => {
    expect(
      service.evaluate({
        ...base,
        selectionName: 'Golden State Warriors',
      }),
    ).toBe('WON');
    expect(
      service.evaluate({
        ...base,
        selectionName: 'Los Angeles Lakers',
      }),
    ).toBe('LOST');
  });

  it('grades total over/under and push as void', () => {
    const totalBase: LegSettlementInput = {
      ...base,
      marketType: MarketType.TOTAL,
      marketLine: '4.50',
      homeScore: 2,
      awayScore: 3,
    };
    expect(
      service.evaluate({ ...totalBase, selectionName: 'Over' }),
    ).toBe('WON');
    expect(
      service.evaluate({ ...totalBase, selectionName: 'Under' }),
    ).toBe('LOST');
    expect(
      service.evaluate({
        ...totalBase,
        marketLine: '5.00',
        homeScore: 2,
        awayScore: 3,
        selectionName: 'Over',
      }),
    ).toBe('VOID');
  });

  it('grades handicap on home side', () => {
    expect(
      service.evaluate({
        ...base,
        marketType: MarketType.HANDICAP,
        marketLine: '-4.50',
        selectionName: 'Los Angeles Lakers -4.5',
      }),
    ).toBe('LOST');
    expect(
      service.evaluate({
        ...base,
        marketType: MarketType.HANDICAP,
        marketLine: '-4.50',
        selectionName: 'Golden State Warriors +4.5',
      }),
    ).toBe('WON');
  });

  it('returns void when market is void', () => {
    expect(
      service.evaluate({
        ...base,
        marketStatus: 'VOID',
        homeScore: null,
        awayScore: null,
      }),
    ).toBe('VOID');
  });
});
