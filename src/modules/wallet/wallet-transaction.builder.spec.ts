import { BetStatus, Prisma } from '@prisma/client';
import { eventWalletHistoryId } from './wallet-event-history';
import {
  buildBetDebitTransaction,
  buildSettlementTransaction,
} from './wallet-transaction.builder';

const legs = [
  {
    legOrder: 0,
    eventId: 'evt-nba-1',
    selectionName: 'Lakers',
    marketType: 'MONEYLINE' as const,
    marketLine: null,
    homeTeamName: 'Lakers',
    awayTeamName: 'Celtics',
    sportKey: 'basketball',
    sportName: 'Basketball',
    leagueKey: 'basketball_nba',
    leagueName: 'NBA',
    priceAtPlacement: new Prisma.Decimal('1.850'),
  },
];

describe('wallet-transaction.builder', () => {
  it('builds bet debit with negative amount and open round flags', () => {
    const createdAt = new Date('2026-06-17T21:05:12.000Z');
    const tx = buildBetDebitTransaction({
      bet: {
        id: 'clbet123',
        username: 'alice',
        casinoGroupId: 'grp1',
        stake: new Prisma.Decimal('10'),
        currency: 'USD',
        createdAt,
      },
      legs,
      transactionCode: '6f3a8c2e-1b4d-4a9f-9e7c-2d5b1a8c3f6e',
    });

    expect(tx.userCode).toBe('alice');
    expect(tx.roundId).toBe('clbet123');
    expect(tx.transactionCode).toBe('6f3a8c2e-1b4d-4a9f-9e7c-2d5b1a8c3f6e');
    expect(tx.historyId).toBe(eventWalletHistoryId('evt-nba-1'));
    expect(tx.gameCode).toBe('basketball_nba');
    expect(tx.amount).toBe('-10');
    expect(tx.isFinished).toBe(false);
    expect(tx.isCanceled).toBe(false);
    expect(tx.detail).toContain('Basketball · NBA');
  });

  it('marks win and lost as finished, void as finished+canceled', () => {
    const bet = {
      id: 'clbet123',
      username: 'alice',
      casinoGroupId: 'grp1',
      stake: new Prisma.Decimal('10'),
      currency: 'USD',
      createdAt: new Date(),
    };

    const win = buildSettlementTransaction({
      bet,
      legs,
      outcome: BetStatus.WON,
      payoutAmount: new Prisma.Decimal('18.5'),
      transactionCode: 'win-tx',
    });
    expect(win.isFinished).toBe(true);
    expect(win.isCanceled).toBe(false);
    expect(win.amount).toBe('18.5');

    const lost = buildSettlementTransaction({
      bet,
      legs,
      outcome: BetStatus.LOST,
      payoutAmount: new Prisma.Decimal('0'),
      transactionCode: 'lost-tx',
    });
    expect(lost.isFinished).toBe(true);
    expect(lost.isCanceled).toBe(false);
    expect(lost.amount).toBe('0');

    const voided = buildSettlementTransaction({
      bet,
      legs,
      outcome: BetStatus.VOID,
      payoutAmount: new Prisma.Decimal('10'),
      transactionCode: 'void-tx',
    });
    expect(voided.isFinished).toBe(true);
    expect(voided.isCanceled).toBe(true);
    expect(voided.amount).toBe('10');
  });
});

describe('eventWalletHistoryId', () => {
  it('is stable for the same event id', () => {
    expect(eventWalletHistoryId('evt-a')).toBe(eventWalletHistoryId('evt-a'));
    expect(eventWalletHistoryId('evt-a')).not.toBe(eventWalletHistoryId('evt-b'));
  });
});
