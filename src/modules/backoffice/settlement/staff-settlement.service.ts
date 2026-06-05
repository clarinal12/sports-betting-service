import { Injectable } from '@nestjs/common';
import { BetStatus, EventStatus, MarketStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class StaffSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  /** Events with open (ACCEPTED) bet exposure that are not fully settled. */
  async listUnsettledEvents(casinoGroupId: string) {
    const eventIds = await this.prisma.betLeg.findMany({
      where: { bet: { casinoGroupId, status: BetStatus.ACCEPTED } },
      select: { eventId: true },
      distinct: ['eventId'],
    });

    const results: {
      eventId: string;
      providerRef: string;
      eventStatus: EventStatus;
      homeScore: number | null;
      awayScore: number | null;
      matchup: string;
      marketStatus: MarketStatus | null;
      readyToSettle: boolean;
    }[] = [];
    for (const { eventId } of eventIds) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          status: true,
          homeScore: true,
          awayScore: true,
          providerRef: true,
          fixture: {
            select: {
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
          },
        },
      });
      if (!event) {
        continue;
      }
      const marketIds = (
        await this.prisma.betLeg.findMany({
          where: {
            eventId,
            bet: { casinoGroupId, status: BetStatus.ACCEPTED },
          },
          select: { marketId: true },
          distinct: ['marketId'],
        })
      ).map((l) => l.marketId);
      const market = await this.prisma.market.findFirst({
        where: { id: { in: marketIds } },
        select: { status: true },
      });
      results.push({
        eventId,
        providerRef: event.providerRef,
        eventStatus: event.status,
        homeScore: event.homeScore,
        awayScore: event.awayScore,
        matchup: `${event.fixture.homeTeam.name} vs ${event.fixture.awayTeam.name}`,
        marketStatus: market?.status ?? null,
        readyToSettle:
          event.status === EventStatus.ENDED &&
          market !== null &&
          (market.status === MarketStatus.SETTLED ||
            market.status === MarketStatus.VOID),
      });
    }
    return results;
  }
}
