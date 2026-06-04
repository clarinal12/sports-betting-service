import { Prisma } from '@prisma/client';
import {
  combinedOddsFromPrices,
  potentialPayout,
  stakeLessOrEqualBalance,
} from './bet-math';

describe('bet-math', () => {
  it('multiplies leg prices for combined odds', () => {
    const odds = combinedOddsFromPrices([
      new Prisma.Decimal('2.00'),
      new Prisma.Decimal('1.50'),
    ]);
    expect(odds.toString()).toBe('3');
  });

  it('computes potential payout rounded down', () => {
    const payout = potentialPayout(
      new Prisma.Decimal('10'),
      new Prisma.Decimal('2.15'),
    );
    expect(payout.toString()).toBe('21.5');
  });

  it('compares stake to balance string', () => {
    expect(
      stakeLessOrEqualBalance(new Prisma.Decimal('10'), '10.00'),
    ).toBe(true);
    expect(
      stakeLessOrEqualBalance(new Prisma.Decimal('10.01'), '10.00'),
    ).toBe(false);
  });
});
