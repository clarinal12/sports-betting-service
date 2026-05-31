import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { MarketResponseDto } from './dto/market-response.dto';
import { marketSelect, toMarketDto } from './market.mapper';

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Markets for an event, restricted to events whose league the tenant enables.
   */
  async listForEvent(
    casinoGroupId: string,
    eventId: string,
  ): Promise<MarketResponseDto[]> {
    await this.assertEventVisible(casinoGroupId, eventId);
    const markets = await this.prisma.market.findMany({
      where: { eventId },
      orderBy: { type: 'asc' },
      select: marketSelect,
    });
    return markets.map(toMarketDto);
  }

  /**
   * A single market, only if its event belongs to a tenant-enabled league.
   */
  async getById(
    casinoGroupId: string,
    marketId: string,
  ): Promise<MarketResponseDto> {
    const market = await this.prisma.market.findFirst({
      where: {
        id: marketId,
        event: {
          fixture: {
            league: { groups: { some: { casinoGroupId, enabled: true } } },
          },
        },
      },
      select: marketSelect,
    });
    if (!market) {
      throw new NotFoundException('Market not found');
    }
    return toMarketDto(market);
  }

  private async assertEventVisible(
    casinoGroupId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        fixture: {
          league: { groups: { some: { casinoGroupId, enabled: true } } },
        },
      },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
  }
}
