import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BetStatus,
  EventStatus,
  MarketStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { decimalToString } from '../../../shared/decimal/decimal.util';
import { AuditService } from '../../../shared/audit/audit.service';
import { PatchRiskLimitsDto } from './dto/patch-limits.dto';

@Injectable()
export class TradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getExposure(casinoGroupId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { casinoGroupId, status: BetStatus.ACCEPTED },
      select: {
        id: true,
        stake: true,
        potentialPayout: true,
        currency: true,
        legs: { select: { eventId: true, selectionId: true, marketId: true } },
      },
    });

    let totalStake = new Prisma.Decimal(0);
    let totalPotentialPayout = new Prisma.Decimal(0);
    const byEvent = new Map<
      string,
      { eventId: string; betCount: number; stake: Prisma.Decimal; potentialPayout: Prisma.Decimal }
    >();

    for (const bet of bets) {
      totalStake = totalStake.plus(bet.stake);
      totalPotentialPayout = totalPotentialPayout.plus(bet.potentialPayout);
      for (const leg of bet.legs) {
        const row = byEvent.get(leg.eventId) ?? {
          eventId: leg.eventId,
          betCount: 0,
          stake: new Prisma.Decimal(0),
          potentialPayout: new Prisma.Decimal(0),
        };
        row.betCount += 1;
        row.stake = row.stake.plus(bet.stake);
        row.potentialPayout = row.potentialPayout.plus(bet.potentialPayout);
        byEvent.set(leg.eventId, row);
      }
    }

    return {
      casinoGroupId,
      openBetCount: bets.length,
      currency: bets[0]?.currency ?? null,
      totalStake: decimalToString(totalStake),
      totalPotentialPayout: decimalToString(totalPotentialPayout),
      byEvent: [...byEvent.values()].map((row) => ({
        eventId: row.eventId,
        legCount: row.betCount,
        stake: decimalToString(row.stake),
        potentialPayout: decimalToString(row.potentialPayout),
      })),
    };
  }

  async getLimits(casinoGroupId: string) {
    const limit = await this.prisma.riskLimit.findFirst({
      where: { casinoGroupId, scope: 'GLOBAL', scopeRef: '' },
    });
    if (!limit) {
      return {
        casinoGroupId,
        scope: 'GLOBAL',
        minStake: null,
        maxStake: null,
        maxPayout: null,
      };
    }
    return {
      casinoGroupId,
      scope: limit.scope,
      minStake: limit.minStake ? decimalToString(limit.minStake) : null,
      maxStake: limit.maxStake ? decimalToString(limit.maxStake) : null,
      maxPayout: limit.maxPayout ? decimalToString(limit.maxPayout) : null,
    };
  }

  async patchLimits(
    casinoGroupId: string,
    dto: PatchRiskLimitsDto,
    staffUserId: string,
  ) {
    const before = await this.getLimits(casinoGroupId);
    const limit = await this.prisma.riskLimit.upsert({
      where: {
        casinoGroupId_scope_scopeRef: {
          casinoGroupId,
          scope: 'GLOBAL',
          scopeRef: '',
        },
      },
      create: {
        casinoGroupId,
        scope: 'GLOBAL',
        scopeRef: '',
        minStake: dto.minStake ? new Prisma.Decimal(dto.minStake) : null,
        maxStake: dto.maxStake ? new Prisma.Decimal(dto.maxStake) : null,
        maxPayout: dto.maxPayout ? new Prisma.Decimal(dto.maxPayout) : null,
      },
      update: {
        minStake: dto.minStake !== undefined
          ? dto.minStake
            ? new Prisma.Decimal(dto.minStake)
            : null
          : undefined,
        maxStake: dto.maxStake !== undefined
          ? dto.maxStake
            ? new Prisma.Decimal(dto.maxStake)
            : null
          : undefined,
        maxPayout: dto.maxPayout !== undefined
          ? dto.maxPayout
            ? new Prisma.Decimal(dto.maxPayout)
            : null
          : undefined,
      },
    });

    const after = {
      minStake: limit.minStake ? decimalToString(limit.minStake) : null,
      maxStake: limit.maxStake ? decimalToString(limit.maxStake) : null,
      maxPayout: limit.maxPayout ? decimalToString(limit.maxPayout) : null,
    };

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'trading.limits_updated',
      entityType: 'RiskLimit',
      entityId: limit.id,
      before,
      after,
    });

    return { casinoGroupId, scope: 'GLOBAL', ...after };
  }

  async suspendEvent(
    casinoGroupId: string,
    eventId: string,
    reason: string,
    staffUserId: string,
  ) {
    const event = await this.assertTenantEvent(casinoGroupId, eventId);
    if (event.status === EventStatus.ENDED || event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Cannot suspend an ended or cancelled event');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.SUSPENDED },
      });
      await tx.market.updateMany({
        where: { eventId },
        data: { status: MarketStatus.SUSPENDED },
      });
      await tx.selection.updateMany({
        where: { market: { eventId } },
        data: { status: SelectionStatus.SUSPENDED },
      });
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'trading.event_suspended',
      entityType: 'Event',
      entityId: eventId,
      reason,
    });

    return { eventId, status: EventStatus.SUSPENDED };
  }

  async suspendMarket(
    casinoGroupId: string,
    marketId: string,
    reason: string,
    staffUserId: string,
  ) {
    const market = await this.assertTenantMarket(casinoGroupId, marketId);
    if (market.status === MarketStatus.SETTLED || market.status === MarketStatus.VOID) {
      throw new BadRequestException('Cannot suspend a settled or void market');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.market.update({
        where: { id: marketId },
        data: { status: MarketStatus.SUSPENDED },
      });
      await tx.selection.updateMany({
        where: { marketId },
        data: { status: SelectionStatus.SUSPENDED },
      });
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'trading.market_suspended',
      entityType: 'Market',
      entityId: marketId,
      reason,
    });

    return { marketId, status: MarketStatus.SUSPENDED };
  }

  async resumeMarket(
    casinoGroupId: string,
    marketId: string,
    staffUserId: string,
  ) {
    const market = await this.assertTenantMarket(casinoGroupId, marketId);
    if (market.event.status === EventStatus.ENDED) {
      throw new BadRequestException('Cannot resume market on an ended event');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.market.update({
        where: { id: marketId },
        data: { status: MarketStatus.OPEN },
      });
      await tx.selection.updateMany({
        where: { marketId },
        data: { status: SelectionStatus.OPEN },
      });
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'trading.market_resumed',
      entityType: 'Market',
      entityId: marketId,
    });

    return { marketId, status: MarketStatus.OPEN };
  }

  private async assertTenantEvent(casinoGroupId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        fixture: {
          league: { groups: { some: { casinoGroupId, enabled: true } } },
        },
      },
      select: { id: true, status: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found for this tenant');
    }
    return event;
  }

  private async assertTenantMarket(casinoGroupId: string, marketId: string) {
    const market = await this.prisma.market.findFirst({
      where: {
        id: marketId,
        event: {
          fixture: {
            league: { groups: { some: { casinoGroupId, enabled: true } } },
          },
        },
      },
      select: {
        id: true,
        status: true,
        event: { select: { status: true } },
      },
    });
    if (!market) {
      throw new NotFoundException('Market not found for this tenant');
    }
    return market;
  }
}
