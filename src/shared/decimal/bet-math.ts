import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

export function combinedOddsFromPrices(prices: Prisma.Decimal[]): Prisma.Decimal {
  const product = prices.reduce(
    (acc, price) => acc.mul(price.toString()),
    new Decimal(1),
  );
  return new Prisma.Decimal(product.toFixed(3));
}

export function potentialPayout(
  stake: Prisma.Decimal,
  combinedOdds: Prisma.Decimal,
): Prisma.Decimal {
  const payout = new Decimal(stake.toString()).mul(combinedOdds.toString());
  return new Prisma.Decimal(payout.toFixed(2, Decimal.ROUND_DOWN));
}

export function stakeLessOrEqualBalance(
  stake: Prisma.Decimal,
  balance: string,
): boolean {
  return new Decimal(stake.toString()).lte(balance);
}
