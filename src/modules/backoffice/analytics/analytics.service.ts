import { Injectable } from '@nestjs/common';
import { BetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { decimalToString } from '../../../shared/decimal/decimal.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(casinoGroupId: string) {
    const bets = await this.prisma.bet.groupBy({
      by: ['status'],
      where: { casinoGroupId },
      _count: { _all: true },
      _sum: { stake: true, payoutAmount: true },
    });

    const byStatus = Object.fromEntries(
      bets.map((row) => [
        row.status,
        {
          count: row._count._all,
          stake: row._sum.stake ? decimalToString(row._sum.stake) : '0',
          payout: row._sum.payoutAmount
            ? decimalToString(row._sum.payoutAmount)
            : '0',
        },
      ]),
    );

    const accepted = bets.find((b) => b.status === BetStatus.ACCEPTED);
    const won = bets.find((b) => b.status === BetStatus.WON);
    const lost = bets.find((b) => b.status === BetStatus.LOST);

    const settledStake = [won, lost].reduce(
      (sum, row) => sum.plus(row?._sum.stake ?? 0),
      new Prisma.Decimal(0),
    );
    const payouts = [won, bets.find((b) => b.status === BetStatus.VOID)].reduce(
      (sum, row) => sum.plus(row?._sum.payoutAmount ?? 0),
      new Prisma.Decimal(0),
    );
    const ggr = settledStake.minus(payouts);

    return {
      casinoGroupId,
      byStatus,
      openLiability: {
        betCount: accepted?._count._all ?? 0,
        stake: accepted?._sum.stake
          ? decimalToString(accepted._sum.stake)
          : '0',
      },
      ggr: {
        settledStake: decimalToString(settledStake),
        payouts: decimalToString(payouts),
        gross: decimalToString(ggr),
      },
    };
  }
}
