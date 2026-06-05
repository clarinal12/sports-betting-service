import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BetStatus, EventStatus, MarketStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { SettlementService } from '../../settlement/settlement.service';

@Injectable()
export class StaffSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
    private readonly ingestion: IngestionService,
    private readonly audit: AuditService,
  ) {}

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
      openBetCount: number;
      blockers: string[];
      readyToSettle: boolean;
    }[] = [];

    for (const { eventId } of eventIds) {
      const row = await this.loadUnsettledEventRow(casinoGroupId, eventId);
      if (row) {
        results.push(row);
      }
    }
    return results;
  }

  async runSettlementForEvent(
    casinoGroupId: string,
    eventId: string,
    staffUserId: string,
  ) {
    const row = await this.loadUnsettledEventRow(casinoGroupId, eventId);
    if (!row) {
      throw new NotFoundException('No open bets found for this event');
    }
    if (!row.readyToSettle) {
      throw new BadRequestException({
        message: 'Event is not ready to settle',
        blockers: row.blockers,
      });
    }

    const result = await this.settlement.settleBetsForEvent(
      eventId,
      casinoGroupId,
    );

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'settlement.event_run',
      entityType: 'Event',
      entityId: eventId,
      after: result,
      reason: 'Staff triggered settlement for event',
    });

    return {
      eventId,
      ...result,
      remainingOpenBets: result.attempted - result.settled,
    };
  }

  async applyManualResultByProviderRef(
    casinoGroupId: string,
    providerRef: string,
    homeScore: number,
    awayScore: number,
    staffUserId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { providerRef: providerRef.trim() },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException(`Event not found for providerRef=${providerRef}`);
    }
    return this.applyManualResultAndSettle(
      casinoGroupId,
      event.id,
      homeScore,
      awayScore,
      staffUserId,
    );
  }

  async applyManualResultAndSettle(
    casinoGroupId: string,
    eventId: string,
    homeScore: number,
    awayScore: number,
    staffUserId: string,
  ) {
    const openBetCount = await this.prisma.bet.count({
      where: {
        casinoGroupId,
        status: BetStatus.ACCEPTED,
        legs: { some: { eventId } },
      },
    });
    if (openBetCount === 0) {
      throw new NotFoundException('No open bets found for this event');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, providerRef: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const updatedEventId = await this.ingestion.finalizeEventResult(
      event.providerRef,
      homeScore,
      awayScore,
    );
    if (!updatedEventId) {
      throw new NotFoundException('Event not found');
    }

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'settlement.manual_result',
      entityType: 'Event',
      entityId: eventId,
      after: { homeScore, awayScore, providerRef: event.providerRef },
      reason: 'Staff entered final score for settlement',
    });

    const result = await this.settlement.settleBetsForEvent(
      eventId,
      casinoGroupId,
    );

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'settlement.event_run',
      entityType: 'Event',
      entityId: eventId,
      after: result,
      reason: 'Settlement run after manual result',
    });

    return {
      eventId,
      homeScore,
      awayScore,
      ...result,
      remainingOpenBets: result.attempted - result.settled,
    };
  }

  private async loadUnsettledEventRow(
    casinoGroupId: string,
    eventId: string,
  ) {
    const openBetCount = await this.prisma.bet.count({
      where: {
        casinoGroupId,
        status: BetStatus.ACCEPTED,
        legs: { some: { eventId } },
      },
    });
    if (openBetCount === 0) {
      return null;
    }

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
      return null;
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

    const blockers = this.describeBlockers(event, market);
    const readyToSettle = blockers.length === 0;

    return {
      eventId,
      providerRef: event.providerRef,
      eventStatus: event.status,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      matchup: `${event.fixture.homeTeam.name} vs ${event.fixture.awayTeam.name}`,
      marketStatus: market?.status ?? null,
      openBetCount,
      blockers,
      readyToSettle,
    };
  }

  private describeBlockers(
    event: {
      status: EventStatus;
      homeScore: number | null;
      awayScore: number | null;
    },
    market: { status: MarketStatus } | null,
  ): string[] {
    const blockers: string[] = [];
    if (event.status !== EventStatus.ENDED) {
      blockers.push(`Event is ${event.status} (need ENDED)`);
    }
    if (!market) {
      blockers.push('No market found for open bets');
    } else if (
      market.status !== MarketStatus.SETTLED &&
      market.status !== MarketStatus.VOID
    ) {
      blockers.push(
        `Market is ${market.status} (need SETTLED or VOID)`,
      );
    }
    if (event.homeScore === null || event.awayScore === null) {
      blockers.push('Final scores missing');
    }
    return blockers;
  }
}
