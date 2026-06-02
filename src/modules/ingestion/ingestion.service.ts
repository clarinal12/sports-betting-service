import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EventStatus,
  FixtureStatus,
  MarketStatus,
  MarketType,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { RealtimePubSubService } from '../realtime/realtime-pubsub.service';
import {
  FIXTURE_PROVIDER,
  type FixtureProviderPort,
  type NormalizedEventStatus,
  type NormalizedFixtureStatus,
  type NormalizedMarketStatus,
  type NormalizedMarketType,
  type NormalizedSelectionStatus,
} from '../providers/provider.types';

export interface IngestionSummary {
  sports: number;
  leagues: number;
  teams: number;
  fixtures: number;
  events: number;
  markets: number;
  selections: number;
  oddsSnapshots: number;
}

const FIXTURE_STATUS_MAP: Record<NormalizedFixtureStatus, FixtureStatus> = {
  SCHEDULED: FixtureStatus.SCHEDULED,
  LIVE: FixtureStatus.LIVE,
  ENDED: FixtureStatus.ENDED,
  POSTPONED: FixtureStatus.POSTPONED,
  CANCELLED: FixtureStatus.CANCELLED,
};

const EVENT_STATUS_MAP: Record<NormalizedEventStatus, EventStatus> = {
  SCHEDULED: EventStatus.SCHEDULED,
  LIVE: EventStatus.LIVE,
  SUSPENDED: EventStatus.SUSPENDED,
  ENDED: EventStatus.ENDED,
  CANCELLED: EventStatus.CANCELLED,
};

const MARKET_TYPE_MAP: Record<NormalizedMarketType, MarketType> = {
  MATCH_RESULT: MarketType.MATCH_RESULT,
  HANDICAP: MarketType.HANDICAP,
  TOTAL: MarketType.TOTAL,
  DOUBLE_CHANCE: MarketType.DOUBLE_CHANCE,
  BOTH_TEAMS_SCORE: MarketType.BOTH_TEAMS_SCORE,
};

const MARKET_STATUS_MAP: Record<NormalizedMarketStatus, MarketStatus> = {
  OPEN: MarketStatus.OPEN,
  SUSPENDED: MarketStatus.SUSPENDED,
  SETTLED: MarketStatus.SETTLED,
  VOID: MarketStatus.VOID,
};

const SELECTION_STATUS_MAP: Record<NormalizedSelectionStatus, SelectionStatus> =
  {
    OPEN: SelectionStatus.OPEN,
    SUSPENDED: SelectionStatus.SUSPENDED,
    SETTLED: SelectionStatus.SETTLED,
    VOID: SelectionStatus.VOID,
  };

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIXTURE_PROVIDER) private readonly provider: FixtureProviderPort,
    private readonly realtime: RealtimePubSubService,
  ) {}

  /**
   * Pulls the provider snapshot and upserts catalog, fixtures, and live data
   * (events, markets, selections) by their unique keys, so repeated runs are
   * idempotent. Records an OddsSnapshot whenever a selection price changes.
   */
  async ingestFixtures(): Promise<IngestionSummary> {
    const snapshot = await this.provider.fetchSnapshot();

    for (const sport of snapshot.sports) {
      await this.prisma.sport.upsert({
        where: { key: sport.key },
        create: { key: sport.key, name: sport.name, slug: sport.slug },
        update: { name: sport.name, slug: sport.slug },
      });
    }

    const sportIdByKey = await this.keyToId(
      this.prisma.sport.findMany({ select: { id: true, key: true } }),
    );

    for (const league of snapshot.leagues) {
      const sportId = sportIdByKey.get(league.sportKey);
      if (!sportId) {
        this.logger.warn(
          `Skipping league ${league.key}: unknown sport ${league.sportKey}`,
        );
        continue;
      }
      await this.prisma.league.upsert({
        where: { key: league.key },
        create: {
          key: league.key,
          name: league.name,
          region: league.region,
          sportId,
        },
        update: { name: league.name, region: league.region, sportId },
      });
    }

    for (const team of snapshot.teams) {
      const sportId = sportIdByKey.get(team.sportKey);
      if (!sportId) {
        this.logger.warn(
          `Skipping team ${team.key}: unknown sport ${team.sportKey}`,
        );
        continue;
      }
      await this.prisma.team.upsert({
        where: { key: team.key },
        create: {
          key: team.key,
          name: team.name,
          shortName: team.shortName,
          sportId,
        },
        update: { name: team.name, shortName: team.shortName, sportId },
      });
    }

    const leagueIdByKey = await this.keyToId(
      this.prisma.league.findMany({ select: { id: true, key: true } }),
    );
    const teamIdByKey = await this.keyToId(
      this.prisma.team.findMany({ select: { id: true, key: true } }),
    );

    let fixtureCount = 0;
    for (const fixture of snapshot.fixtures) {
      const leagueId = leagueIdByKey.get(fixture.leagueKey);
      const homeTeamId = teamIdByKey.get(fixture.homeTeamKey);
      const awayTeamId = teamIdByKey.get(fixture.awayTeamKey);
      if (!leagueId || !homeTeamId || !awayTeamId) {
        this.logger.warn(
          `Skipping fixture ${fixture.providerRef}: unresolved references`,
        );
        continue;
      }
      const data = {
        leagueId,
        homeTeamId,
        awayTeamId,
        startsAt: new Date(fixture.startsAt),
        status: FIXTURE_STATUS_MAP[fixture.status],
      };
      await this.prisma.fixture.upsert({
        where: { providerRef: fixture.providerRef },
        create: { providerRef: fixture.providerRef, ...data },
        update: data,
      });
      fixtureCount += 1;
    }

    const { events, markets, selections, oddsSnapshots } =
      await this.ingestLiveData(snapshot);

    const summary: IngestionSummary = {
      sports: snapshot.sports.length,
      leagues: snapshot.leagues.length,
      teams: snapshot.teams.length,
      fixtures: fixtureCount,
      events,
      markets,
      selections,
      oddsSnapshots,
    };
    this.logger.log(
      `Ingested sports=${summary.sports} leagues=${summary.leagues} ` +
        `teams=${summary.teams} fixtures=${summary.fixtures} ` +
        `events=${summary.events} markets=${summary.markets} ` +
        `selections=${summary.selections} oddsSnapshots=${summary.oddsSnapshots}`,
    );
    return summary;
  }

  private async ingestLiveData(
    snapshot: Awaited<ReturnType<FixtureProviderPort['fetchSnapshot']>>,
  ): Promise<{
    events: number;
    markets: number;
    selections: number;
    oddsSnapshots: number;
  }> {
    const fixtureIdByRef = await this.keyToId(
      this.prisma.fixture
        .findMany({ select: { id: true, providerRef: true } })
        .then((rows) =>
          rows.map((row) => ({ id: row.id, key: row.providerRef })),
        ),
    );

    let eventCount = 0;
    for (const event of snapshot.events) {
      const fixtureId = fixtureIdByRef.get(event.fixtureProviderRef);
      if (!fixtureId) {
        this.logger.warn(
          `Skipping event ${event.providerRef}: unknown fixture ${event.fixtureProviderRef}`,
        );
        continue;
      }
      const data = {
        fixtureId,
        status: EVENT_STATUS_MAP[event.status],
        homeScore: event.homeScore ?? null,
        awayScore: event.awayScore ?? null,
        period: event.period ?? null,
        clock: event.clock ?? null,
      };
      const saved = await this.prisma.event.upsert({
        where: { providerRef: event.providerRef },
        create: { providerRef: event.providerRef, ...data },
        update: data,
        select: {
          id: true,
          status: true,
          homeScore: true,
          awayScore: true,
          period: true,
          clock: true,
        },
      });
      await this.realtime.publishEventUpdate(saved.id, {
        status: saved.status,
        homeScore: saved.homeScore,
        awayScore: saved.awayScore,
        period: saved.period,
        clock: saved.clock,
      });
      eventCount += 1;
    }

    const eventIdByRef = await this.keyToId(
      this.prisma.event
        .findMany({ select: { id: true, providerRef: true } })
        .then((rows) =>
          rows.map((row) => ({ id: row.id, key: row.providerRef })),
        ),
    );

    let marketCount = 0;
    for (const market of snapshot.markets) {
      const eventId = eventIdByRef.get(market.eventProviderRef);
      if (!eventId) {
        this.logger.warn(
          `Skipping market ${market.providerRef}: unknown event ${market.eventProviderRef}`,
        );
        continue;
      }
      const data = {
        eventId,
        type: MARKET_TYPE_MAP[market.type],
        status: MARKET_STATUS_MAP[market.status],
        line: market.line ? new Prisma.Decimal(market.line) : null,
      };
      await this.prisma.market.upsert({
        where: { providerRef: market.providerRef },
        create: { providerRef: market.providerRef, ...data },
        update: data,
      });
      marketCount += 1;
    }

    const marketIdByRef = await this.keyToId(
      this.prisma.market
        .findMany({ select: { id: true, providerRef: true } })
        .then((rows) =>
          rows.map((row) => ({ id: row.id, key: row.providerRef })),
        ),
    );

    const existingSelections = await this.prisma.selection.findMany({
      select: { providerRef: true, price: true },
    });
    const priceByRef = new Map(
      existingSelections.map((s) => [s.providerRef, s.price]),
    );

    let selectionCount = 0;
    let snapshotCount = 0;
    for (const selection of snapshot.selections) {
      const marketId = marketIdByRef.get(selection.marketProviderRef);
      if (!marketId) {
        this.logger.warn(
          `Skipping selection ${selection.providerRef}: unknown market ${selection.marketProviderRef}`,
        );
        continue;
      }
      const price = new Prisma.Decimal(selection.price);
      const previous = priceByRef.get(selection.providerRef);
      const priceChanged = !previous || !previous.equals(price);

      const saved = await this.prisma.selection.upsert({
        where: { providerRef: selection.providerRef },
        create: {
          providerRef: selection.providerRef,
          marketId,
          name: selection.name,
          status: SELECTION_STATUS_MAP[selection.status],
          price,
        },
        update: {
          marketId,
          name: selection.name,
          status: SELECTION_STATUS_MAP[selection.status],
          price,
        },
        select: { id: true },
      });
      selectionCount += 1;

      if (priceChanged) {
        await this.prisma.oddsSnapshot.create({
          data: { selectionId: saved.id, price },
        });
        await this.realtime.publishSelectionOdds(
          marketId,
          saved.id,
          price,
          SELECTION_STATUS_MAP[selection.status],
        );
        snapshotCount += 1;
      }
    }

    return {
      events: eventCount,
      markets: marketCount,
      selections: selectionCount,
      oddsSnapshots: snapshotCount,
    };
  }

  private async keyToId(
    query: Promise<{ id: string; key: string }[]>,
  ): Promise<Map<string, string>> {
    const rows = await query;
    return new Map(rows.map((row) => [row.key, row.id]));
  }
}
