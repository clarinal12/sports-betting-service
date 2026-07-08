import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BetStatus,
  EventStatus,
  MarketStatus,
  WalletOutboxStatus,
} from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { decimalToString } from '../../../shared/decimal/decimal.util';
import { AuditService } from '../../../shared/audit/audit.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { SettlementService } from '../../settlement/settlement.service';
import { WalletOutboxService } from '../../wallet/wallet-outbox.service';
import {
  WALLET_OUTBOX_SETTLE,
  deserializeWalletTransaction,
} from '../../wallet/wallet-outbox.types';

@Injectable()
export class StaffSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
    private readonly ingestion: IngestionService,
    private readonly audit: AuditService,
    private readonly walletOutbox: WalletOutboxService,
  ) {}

  /**
   * Bets graded in DB but wallet settlement batch not yet delivered
   * (PENDING `WALLET_SETTLE` outbox rows).
   */
  async listWalletSettlementQueue(casinoGroupId: string) {
    const now = new Date();
    const rows = await this.prisma.walletOutbox.findMany({
      where: {
        casinoGroupId,
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
      },
      orderBy: [{ batchId: 'asc' }, { createdAt: 'asc' }],
      take: 200,
      select: {
        id: true,
        betId: true,
        batchId: true,
        transactionCode: true,
        status: true,
        attempts: true,
        lastError: true,
        nextRetryAt: true,
        createdAt: true,
        updatedAt: true,
        payload: true,
      },
    });

    const betIds = [...new Set(rows.map((row) => row.betId))];
    const bets =
      betIds.length > 0
        ? await this.prisma.bet.findMany({
            where: { id: { in: betIds }, casinoGroupId },
            select: {
              id: true,
              userId: true,
              username: true,
              status: true,
              stake: true,
              payoutAmount: true,
              currency: true,
              settledAt: true,
            },
          })
        : [];
    const betById = new Map(bets.map((bet) => [bet.id, bet]));

    const batchStats = new Map<
      string,
      { batchId: string; count: number; oldestCreatedAt: Date }
    >();

    const items = rows
      .filter((row) => betById.has(row.betId))
      .map((row) => {
        const bet = betById.get(row.betId)!;
        const batchKey = row.batchId ?? 'unassigned';
        const existing = batchStats.get(batchKey);
        if (!existing) {
          batchStats.set(batchKey, {
            batchId: batchKey,
            count: 1,
            oldestCreatedAt: row.createdAt,
          });
        } else {
          existing.count += 1;
          if (row.createdAt < existing.oldestCreatedAt) {
            existing.oldestCreatedAt = row.createdAt;
          }
        }

        let walletAmount: string | null = null;
        try {
          walletAmount = deserializeWalletTransaction(row.payload).amount;
        } catch {
          walletAmount = null;
        }

        const retryDue =
          row.nextRetryAt === null || row.nextRetryAt.getTime() <= now.getTime();

        return {
          outboxId: row.id,
          betId: row.betId,
          batchId: row.batchId,
          transactionCode: row.transactionCode,
          outboxStatus: row.status,
          attempts: row.attempts,
          lastError: row.lastError,
          nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
          retryDue,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          walletAmount,
          bet: {
            id: bet.id,
            userId: bet.userId,
            username: bet.username,
            status: bet.status,
            stake: decimalToString(bet.stake),
            payoutAmount: bet.payoutAmount
              ? decimalToString(bet.payoutAmount)
              : null,
            currency: bet.currency,
            settledAt: bet.settledAt?.toISOString() ?? null,
          },
        };
      });

    const batches = [...batchStats.values()]
      .map((batch) => ({
        batchId: batch.batchId === 'unassigned' ? null : batch.batchId,
        count: batch.count,
        oldestCreatedAt: batch.oldestCreatedAt.toISOString(),
      }))
      .sort((a, b) => a.oldestCreatedAt.localeCompare(b.oldestCreatedAt));

    return {
      casinoGroupId,
      summary: {
        pendingCount: items.length,
        batchCount: batches.length,
        retryingCount: items.filter((item) => item.attempts > 0).length,
        dueNowCount: items.filter((item) => item.retryDue).length,
      },
      batches,
      items,
    };
  }

  /**
   * Staff-triggered retry: clear settlement outbox backoff and POST pending
   * batches to the merchant wallet immediately.
   */
  async retryWalletSettlementTransmission(
    casinoGroupId: string,
    staffUserId: string,
  ) {
    const pendingBefore = await this.prisma.walletOutbox.count({
      where: {
        casinoGroupId,
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
      },
    });

    if (pendingBefore === 0) {
      return {
        casinoGroupId,
        batchesSent: 0,
        pendingBefore: 0,
        pendingAfter: 0,
      };
    }

    await this.prisma.walletOutbox.updateMany({
      where: {
        casinoGroupId,
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
      },
      data: { nextRetryAt: null },
    });

    const batchesSent =
      await this.walletOutbox.flushSettlementBatchesForCasinoGroup(
        casinoGroupId,
      );

    const pendingAfter = await this.prisma.walletOutbox.count({
      where: {
        casinoGroupId,
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
      },
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'settlement.wallet_retry',
      entityType: 'CasinoGroup',
      entityId: casinoGroupId,
      after: { batchesSent, pendingBefore, pendingAfter },
      reason: 'Staff manually triggered wallet settlement transmission',
    });

    return {
      casinoGroupId,
      batchesSent,
      pendingBefore,
      pendingAfter,
    };
  }

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
