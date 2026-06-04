import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetStatus, EventStatus } from '@prisma/client';
import { EnvConfig } from '../../shared/config/env.validation';
import { PrismaService } from '../../shared/database/prisma.service';
import { ProviderSnapshot } from '../providers/provider.types';
import { mapOddsApiToSnapshot } from '../providers/odds-api/odds-api.mapper';
import { OddsApiProvider } from '../providers/odds-api/odds-api.provider';
import { syntheticOddsApiSport } from '../providers/odds-api/odds-api-sport.util';
import type { OddsApiEventScore } from '../providers/odds-api/odds-api.types';
import { IngestionService } from './ingestion.service';
import { SettlementService } from '../settlement/settlement.service';

const EVENT_ID_CHUNK_SIZE = 20;

export interface ResultsIngestSummary {
  skipped: boolean;
  sportKeys: string[];
  eventIdsRequested: number;
  scoresReturned: number;
  eventsUpdated: number;
  betsSettled: number;
  betsFlaggedStale: number;
}

@Injectable()
export class ResultsIngestService {
  private readonly logger = new Logger(ResultsIngestService.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly oddsApi: OddsApiProvider,
    private readonly settlement: SettlementService,
  ) {}

  /**
   * Polls /scores for ACCEPTED-bet events, updates DB, flags stale liabilities,
   * then runs settlement.
   */
  async runResultsAndSettlement(): Promise<ResultsIngestSummary> {
    const ingest = await this.ingestOpenBetResults();
    const betsSettled = await this.settlement.settleBatch();
    if (betsSettled > 0) {
      this.logger.log(`Settlement processed ${betsSettled} bet(s)`);
    }
    return { ...ingest, betsSettled };
  }

  async ingestOpenBetResults(): Promise<ResultsIngestSummary> {
    if (this.config.get('FIXTURE_PROVIDER', { infer: true }) !== 'odds-api') {
      this.logger.debug('Results ingest skipped (FIXTURE_PROVIDER is not odds-api)');
      return {
        skipped: true,
        sportKeys: [],
        eventIdsRequested: 0,
        scoresReturned: 0,
        eventsUpdated: 0,
        betsSettled: 0,
        betsFlaggedStale: 0,
      };
    }

    const liabilities = await this.loadOpenBetEvents();
    if (liabilities.length === 0) {
      this.logger.log('Results ingest: no ACCEPTED bets to refresh');
      return {
        skipped: false,
        sportKeys: [],
        eventIdsRequested: 0,
        scoresReturned: 0,
        eventsUpdated: 0,
        betsSettled: 0,
        betsFlaggedStale: 0,
      };
    }

    const bySport = this.groupBySport(liabilities);
    let scoresReturned = 0;
    let eventsUpdated = 0;

    for (const [sportKey, rows] of bySport) {
      const eventIds = [...new Set(rows.map((r) => r.providerRef))];
      for (let i = 0; i < eventIds.length; i += EVENT_ID_CHUNK_SIZE) {
        const chunk = eventIds.slice(i, i + EVENT_ID_CHUNK_SIZE);
        let scores: OddsApiEventScore[] = [];
        try {
          scores = await this.oddsApi.fetchScoresForEventIds(sportKey, chunk);
        } catch (error) {
          this.logger.warn(
            `Results ingest failed for ${sportKey}: ${(error as Error).message}`,
          );
          continue;
        }
        scoresReturned += scores.length;
        if (scores.length === 0) {
          continue;
        }
        const snapshot = this.snapshotFromScores(sportKey, scores);
        const applied = await this.ingestion.applyResultsSnapshot(snapshot);
        eventsUpdated += applied.events;
      }
    }

    const betsFlaggedStale = await this.flagStaleBets();

    this.logger.log(
      `Results ingest: sports=${[...bySport.keys()].join(',')} eventIds=${liabilities.length} scores=${scoresReturned} eventsUpdated=${eventsUpdated} staleFlags=${betsFlaggedStale}`,
    );

    return {
      skipped: false,
      sportKeys: [...bySport.keys()],
      eventIdsRequested: liabilities.length,
      scoresReturned,
      eventsUpdated,
      betsSettled: 0,
      betsFlaggedStale,
    };
  }

  private snapshotFromScores(
    sportKey: string,
    scores: OddsApiEventScore[],
  ): ProviderSnapshot {
    return mapOddsApiToSnapshot({
      sportKeys: [sportKey],
      apiSports: [syntheticOddsApiSport(sportKey)],
      oddsBySport: new Map([[sportKey, []]]),
      scoresBySport: new Map([[sportKey, scores]]),
      marketKeys: [],
    });
  }

  private async loadOpenBetEvents(): Promise<
    { providerRef: string; sportKey: string; kickoff: Date }[]
  > {
    const legs = await this.prisma.betLeg.findMany({
      where: { bet: { status: BetStatus.ACCEPTED } },
      select: { eventId: true },
      distinct: ['eventId'],
    });
    if (legs.length === 0) {
      return [];
    }

    const events = await this.prisma.event.findMany({
      where: { id: { in: legs.map((leg) => leg.eventId) } },
      select: {
        providerRef: true,
        fixture: {
          select: {
            startsAt: true,
            league: { select: { key: true } },
          },
        },
      },
    });

    return events.map((event) => ({
      providerRef: event.providerRef,
      sportKey: event.fixture.league.key,
      kickoff: event.fixture.startsAt,
    }));
  }

  private groupBySport(
    rows: { providerRef: string; sportKey: string; kickoff: Date }[],
  ): Map<string, typeof rows> {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = map.get(row.sportKey) ?? [];
      list.push(row);
      map.set(row.sportKey, list);
    }
    return map;
  }

  private async flagStaleBets(): Promise<number> {
    const staleHours = this.config.get('SETTLEMENT_STALE_HOURS', { infer: true });
    const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);

    const bets = await this.prisma.bet.findMany({
      where: { status: BetStatus.ACCEPTED },
      include: {
        legs: { select: { eventId: true } },
      },
    });

    let flagged = 0;
    for (const bet of bets) {
      const eventIds = [...new Set(bet.legs.map((leg) => leg.eventId))];
      const events = await this.prisma.event.findMany({
        where: { id: { in: eventIds } },
        select: {
          status: true,
          fixture: { select: { startsAt: true } },
        },
      });
      const overdue = events.some(
        (event) =>
          event.fixture.startsAt < cutoff &&
          event.status !== EventStatus.ENDED,
      );
      if (!overdue) {
        if (bet.settlementNote) {
          await this.prisma.bet.update({
            where: { id: bet.id },
            data: { settlementNote: null },
          });
        }
        continue;
      }

      const note =
        `Awaiting results (${staleHours}h+ since kickoff). ` +
        'Use npm run result:manual if The Odds API no longer returns this event.';
      if (bet.settlementNote !== note) {
        await this.prisma.bet.update({
          where: { id: bet.id },
          data: { settlementNote: note },
        });
        flagged += 1;
        this.logger.warn(`Bet ${bet.id.slice(0, 12)}… flagged: ${note}`);
      }
    }
    return flagged;
  }
}
