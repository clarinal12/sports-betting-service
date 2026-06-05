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

  /** Daily GGR rollup by sport for settled bets (exit-criteria finance view). */
  async dailyGgrBySport(casinoGroupId: string, days = 7) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (safeDays - 1));

    const bets = await this.prisma.bet.findMany({
      where: {
        casinoGroupId,
        status: { in: [BetStatus.WON, BetStatus.LOST, BetStatus.VOID] },
        settledAt: { gte: since },
      },
      select: {
        stake: true,
        payoutAmount: true,
        settledAt: true,
        status: true,
        legs: {
          take: 1,
          orderBy: { legOrder: 'asc' },
          select: { eventId: true },
        },
      },
    });

    const eventIds = [
      ...new Set(
        bets
          .map((bet) => bet.legs[0]?.eventId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: {
        id: true,
        fixture: {
          select: {
            league: {
              select: {
                sport: { select: { slug: true, name: true } },
              },
            },
          },
        },
      },
    });
    const sportByEventId = new Map(
      events.map((event) => [event.id, event.fixture.league.sport]),
    );

    const buckets = new Map<
      string,
      {
        date: string;
        sportSlug: string;
        sportName: string;
        betCount: number;
        settledStake: Prisma.Decimal;
        payouts: Prisma.Decimal;
      }
    >();

    for (const bet of bets) {
      if (!bet.settledAt) {
        continue;
      }
      const date = bet.settledAt.toISOString().slice(0, 10);
      const eventId = bet.legs[0]?.eventId;
      const sport = eventId ? sportByEventId.get(eventId) : undefined;
      const sportSlug = sport?.slug ?? 'unknown';
      const sportName = sport?.name ?? 'Unknown';
      const key = `${date}|${sportSlug}`;
      const row = buckets.get(key) ?? {
        date,
        sportSlug,
        sportName,
        betCount: 0,
        settledStake: new Prisma.Decimal(0),
        payouts: new Prisma.Decimal(0),
      };
      row.betCount += 1;
      if (bet.status === BetStatus.WON || bet.status === BetStatus.LOST) {
        row.settledStake = row.settledStake.plus(bet.stake);
      }
      row.payouts = row.payouts.plus(bet.payoutAmount ?? 0);
      buckets.set(key, row);
    }

    const rows = [...buckets.values()]
      .map((row) => ({
        date: row.date,
        sportSlug: row.sportSlug,
        sportName: row.sportName,
        betCount: row.betCount,
        settledStake: decimalToString(row.settledStake),
        payouts: decimalToString(row.payouts),
        ggr: decimalToString(row.settledStake.minus(row.payouts)),
      }))
      .sort((a, b) =>
        a.date === b.date
          ? a.sportSlug.localeCompare(b.sportSlug)
          : b.date.localeCompare(a.date),
      );

    return {
      casinoGroupId,
      days: safeDays,
      since: since.toISOString(),
      rows,
    };
  }
}
