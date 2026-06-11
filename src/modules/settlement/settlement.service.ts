import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Bet,
  BetLeg,
  BetLegOutcome,
  BetStatus,
  EventStatus,
  MarketStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { decimalToString } from '../../shared/decimal/decimal.util';
import { MetricsService } from '../../shared/metrics/metrics.service';
import {
  buildLegSettlementInput,
  hasLegSnapshot,
  type LegPlacementSnapshot,
} from '../bets/bet-leg-snapshot';
import { WALLET_PORT } from '../wallet/wallet.port';
import type { WalletPort } from '../wallet/wallet.port';
import { LegOutcomeService, LegResult } from './leg-outcome.service';

const BATCH_SIZE = 50;

interface GradedBet {
  bet: Bet & { legs: BetLeg[] };
  legResults: LegResult[];
  betResult: BetStatus;
  payoutAmount: Prisma.Decimal;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly legOutcome: LegOutcomeService,
    @Inject(WALLET_PORT) private readonly wallet: WalletPort,
    private readonly metrics: MetricsService,
  ) {}

  async logWhyAcceptedBetsAreUnsettled(limit = 10): Promise<void> {
    const bets = await this.prisma.bet.findMany({
      where: { status: BetStatus.ACCEPTED },
      include: { legs: { orderBy: { legOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    if (bets.length === 0) {
      this.logger.log('No ACCEPTED bets waiting for settlement');
      return;
    }
    for (const bet of bets) {
      const blockers: string[] = [];
      for (const leg of bet.legs) {
        const ctx = await this.loadLegContext(leg);
        if (!ctx) {
          blockers.push(`leg ${leg.selectionName}: event/market not found`);
          continue;
        }
        if (ctx.eventStatus !== EventStatus.ENDED) {
          blockers.push(
            `${leg.selectionName}: event is ${ctx.eventStatus} (need ENDED)`,
          );
        }
        if (
          ctx.marketStatus !== MarketStatus.SETTLED &&
          ctx.marketStatus !== MarketStatus.VOID
        ) {
          blockers.push(
            `${leg.selectionName}: market is ${ctx.marketStatus} (need SETTLED or VOID)`,
          );
        }
        if (ctx.homeScore === null || ctx.awayScore === null) {
          blockers.push(`${leg.selectionName}: final scores not in DB yet`);
        }
      }
      this.logger.warn(
        `Bet ${bet.id.slice(0, 12)}… not settleable: ${blockers.join('; ')}`,
      );
    }
  }

  async settleBetsForEvent(
    eventId: string,
    casinoGroupId: string,
  ): Promise<{ settled: number; attempted: number }> {
    const bets = await this.prisma.bet.findMany({
      where: {
        casinoGroupId,
        status: BetStatus.ACCEPTED,
        legs: { some: { eventId } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    let settled = 0;
    for (const { id } of bets) {
      if (await this.trySettleBet(id)) {
        settled += 1;
      }
    }
    return { settled, attempted: bets.length };
  }

  async settleBatch(): Promise<number> {
    const bets = await this.prisma.bet.findMany({
      where: { status: BetStatus.ACCEPTED },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    });

    const graded: GradedBet[] = [];
    for (const { id } of bets) {
      const result = await this.gradeBet(id);
      if (result) {
        graded.push(result);
      }
    }

    if (graded.length === 0) {
      return 0;
    }

    await this.applySettlements(graded);
    return graded.length;
  }

  async trySettleBet(betId: string): Promise<boolean> {
    const graded = await this.gradeBet(betId);
    if (!graded) {
      return false;
    }
    await this.applySettlements([graded]);
    return true;
  }

  private async gradeBet(betId: string): Promise<GradedBet | null> {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId, status: BetStatus.ACCEPTED },
      include: {
        legs: {
          orderBy: { legOrder: 'asc' },
        },
      },
    });
    if (!bet) {
      return null;
    }

    const legContexts = await Promise.all(
      bet.legs.map((leg) => this.loadLegContext(leg)),
    );
    if (legContexts.some((ctx) => ctx === null)) {
      return null;
    }

    const contexts = legContexts.filter(
      (ctx): ctx is NonNullable<typeof ctx> => ctx !== null,
    );

    if (
      contexts.some(
        (ctx) =>
          ctx.eventStatus !== EventStatus.ENDED ||
          (ctx.marketStatus !== MarketStatus.SETTLED &&
            ctx.marketStatus !== MarketStatus.VOID),
      )
    ) {
      return null;
    }

    const legResults: LegResult[] = [];
    for (const ctx of contexts) {
      const result = this.legOutcome.evaluate({
        marketType: ctx.marketType,
        marketStatus: ctx.marketStatus,
        marketLine: ctx.marketLine,
        selectionName: ctx.selectionName,
        homeTeamName: ctx.homeTeamName,
        awayTeamName: ctx.awayTeamName,
        homeScore: ctx.homeScore,
        awayScore: ctx.awayScore,
      });
      if (result === null) {
        return null;
      }
      legResults.push(result);
    }

    const betResult = this.aggregateBetResult(legResults);
    const payoutAmount = this.payoutForResult(
      bet.stake,
      bet.potentialPayout,
      betResult,
    );

    return { bet, legResults, betResult, payoutAmount };
  }

  private async applySettlements(graded: GradedBet[]): Promise<void> {
    const withPayout = graded.filter((entry) => entry.payoutAmount.gt(0));
    const byGroup = new Map<string, GradedBet[]>();
    for (const entry of withPayout) {
      const list = byGroup.get(entry.bet.casinoGroupId) ?? [];
      list.push(entry);
      byGroup.set(entry.bet.casinoGroupId, list);
    }

    for (const [casinoGroupId, entries] of byGroup) {
      await this.wallet.creditPayoutBatch({
        casinoGroupId,
        batchId: randomUUID(),
        items: entries.map((entry) => ({
          userId: entry.bet.userId,
          amount: decimalToString(entry.payoutAmount),
          currency: entry.bet.currency,
          reference: entry.bet.id,
          idempotencyKey: `settle-${entry.bet.id}`,
          type: entry.betResult === BetStatus.WON ? 'WIN' : 'REFUND',
        })),
      });
    }

    for (const entry of graded) {
      await this.persistGradedBet(entry);
      this.metrics.recordBetSettled(entry.betResult);
      this.logger.log(
        `Settled bet ${entry.bet.id} as ${entry.betResult} (payout ${decimalToString(entry.payoutAmount)})`,
      );
    }
  }

  private async persistGradedBet(entry: GradedBet): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < entry.bet.legs.length; i++) {
        await tx.betLeg.update({
          where: { id: entry.bet.legs[i].id },
          data: { outcome: this.toLegOutcome(entry.legResults[i]) },
        });
      }
      await tx.bet.update({
        where: { id: entry.bet.id },
        data: {
          status: entry.betResult,
          payoutAmount: entry.payoutAmount,
          settledAt: new Date(),
          settlementNote: null,
        },
      });
    });
  }

  private aggregateBetResult(legResults: LegResult[]): BetStatus {
    if (legResults.some((r) => r === 'VOID')) {
      return BetStatus.VOID;
    }
    if (legResults.some((r) => r === 'LOST')) {
      return BetStatus.LOST;
    }
    return BetStatus.WON;
  }

  private payoutForResult(
    stake: Prisma.Decimal,
    potentialPayout: Prisma.Decimal,
    result: BetStatus,
  ): Prisma.Decimal {
    if (result === BetStatus.WON) {
      return potentialPayout;
    }
    if (result === BetStatus.VOID) {
      return stake;
    }
    return new Prisma.Decimal(0);
  }

  private toLegOutcome(result: LegResult): BetLegOutcome {
    return result as BetLegOutcome;
  }

  private async loadLegContext(leg: BetLeg) {
    const [event, market] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: leg.eventId },
        select: {
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
      }),
      this.prisma.market.findUnique({
        where: { id: leg.marketId },
        select: { status: true, type: true, line: true },
      }),
    ]);
    if (!event || !market) {
      return null;
    }

    if (hasLegSnapshot(leg)) {
      const snapshot: LegPlacementSnapshot = {
        marketType: leg.marketType!,
        marketLine: leg.marketLine ? leg.marketLine.toFixed(2) : null,
        homeTeamName: leg.homeTeamName!,
        awayTeamName: leg.awayTeamName!,
        eventProviderRef: leg.eventProviderRef ?? event.providerRef,
      };
      const grade = buildLegSettlementInput(leg, snapshot, {
        marketStatus: market.status,
        eventStatus: event.status,
        homeScore: event.homeScore,
        awayScore: event.awayScore,
      });
      return { ...grade, eventStatus: event.status };
    }

    const selection = await this.prisma.selection.findUnique({
      where: { id: leg.selectionId },
      select: { id: true },
    });
    if (!selection) {
      return null;
    }

    return {
      marketType: market.type,
      marketStatus: market.status,
      marketLine: market.line ? market.line.toFixed(2) : null,
      selectionName: leg.selectionName,
      homeTeamName: event.fixture.homeTeam.name,
      awayTeamName: event.fixture.awayTeam.name,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      eventStatus: event.status,
    };
  }
}
