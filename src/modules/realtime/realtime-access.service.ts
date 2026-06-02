import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

/**
 * Validates that events/markets are visible to a casino group before joining WS rooms.
 */
@Injectable()
export class RealtimeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async filterVisibleEventIds(
    casinoGroupId: string,
    eventIds: string[],
  ): Promise<string[]> {
    if (eventIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.event.findMany({
      where: {
        id: { in: eventIds },
        fixture: {
          league: { groups: { some: { casinoGroupId, enabled: true } } },
        },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async filterVisibleMarketIds(
    casinoGroupId: string,
    marketIds: string[],
  ): Promise<string[]> {
    if (marketIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.market.findMany({
      where: {
        id: { in: marketIds },
        event: {
          fixture: {
            league: { groups: { some: { casinoGroupId, enabled: true } } },
          },
        },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Casino groups that should receive updates for an event (enabled league). */
  async groupIdsForEvent(eventId: string): Promise<string[]> {
    const rows = await this.prisma.casinoGroupLeague.findMany({
      where: {
        enabled: true,
        league: { fixtures: { some: { event: { id: eventId } } } },
      },
      select: { casinoGroupId: true },
      distinct: ['casinoGroupId'],
    });
    return rows.map((row) => row.casinoGroupId);
  }

  /** Casino groups that should receive updates for a market. */
  async groupIdsForMarket(marketId: string): Promise<string[]> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      select: {
        event: { select: { fixture: { select: { leagueId: true } } } },
      },
    });
    if (!market) {
      return [];
    }
    const rows = await this.prisma.casinoGroupLeague.findMany({
      where: {
        enabled: true,
        leagueId: market.event.fixture.leagueId,
      },
      select: { casinoGroupId: true },
      distinct: ['casinoGroupId'],
    });
    return rows.map((row) => row.casinoGroupId);
  }
}
