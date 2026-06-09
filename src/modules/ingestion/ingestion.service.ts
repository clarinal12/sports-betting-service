import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../shared/config/env.validation';
import {
  BetStatus,
  EventStatus,
  FixtureStatus,
  MarketStatus,
  MarketType,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import {
  ACME_LEAGUE_PREFIXES,
  BETZONE_LEAGUE_PREFIXES,
  ACME_INGEST_SPORT_KEYS,
  isLeagueOffered,
} from '../casino-groups/tenant-offering.config';
import { AuditService } from '../../shared/audit/audit.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { MetricsService } from '../../shared/metrics/metrics.service';
import { RealtimePubSubService } from '../realtime/realtime-pubsub.service';
import {
  FIXTURE_PROVIDER,
  type FixtureProviderPort,
  type NormalizedEventStatus,
  type NormalizedFixtureStatus,
  type NormalizedMarketStatus,
  type NormalizedMarketType,
  type NormalizedSelectionStatus,
  type ProviderSnapshot,
} from '../providers/provider.types';
import { hasLiveGames, resolveLiveSportKeys } from './ingestion-live.scope';
import {
  MOCK_FIXTURE_PROVIDER_PREFIX,
  MOCK_TEAM_KEYS,
} from '../providers/mock/mock-catalog.constants';

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

export interface LiveIngestionSummary extends IngestionSummary {
  sportKeys: string[];
  skipped: boolean;
}

export interface PurgeMockCatalogSummary {
  fixturesRemoved: number;
  /** Ended in place when bet history blocks hard delete (voided/settled legs). */
  fixturesRetired: number;
  fixturesSkipped: number;
  teamsRemoved: number;
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
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly realtime: RealtimePubSubService,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Pulls the provider snapshot and upserts catalog, fixtures, and live data
   * (events, markets, selections) by their unique keys, so repeated runs are
   * idempotent. Records an OddsSnapshot whenever a selection price changes.
   */
  async ingestFixtures(): Promise<IngestionSummary> {
    return this.runIngestion('catalog', async () => {
      const snapshot = await this.provider.fetchSnapshot();
      await this.upsertCatalogFromSnapshot(snapshot);
      await this.syncTenantLeagues('acme', ACME_LEAGUE_PREFIXES);
      await this.syncTenantLeagues('betzone', BETZONE_LEAGUE_PREFIXES);
      const fixtureCount = await this.upsertFixturesFromSnapshot(snapshot, {
        purgeStale: true,
      });
      const live = await this.ingestLiveData(snapshot);
      const summary = this.buildSummary(snapshot, fixtureCount, live);
      this.logIngestion('Catalog ingest', summary);
      return summary;
    });
  }

  /**
   * Removes mock-provider catalog rows while keeping tenants and bet history.
   * Fixtures with only voided/settled legs are ended in place (FK-safe).
   */
  async purgeMockCatalog(): Promise<PurgeMockCatalogSummary> {
    const mockFixtureWhere: Prisma.FixtureWhereInput = {
      providerRef: { startsWith: MOCK_FIXTURE_PROVIDER_PREFIX },
    };

    const fixturesSkipped = await this.prisma.fixture.count({
      where: { AND: [mockFixtureWhere, this.fixtureHasActiveBetsWhere()] },
    });

    const fixturesRemoved = await this.deleteStaleFixtures(mockFixtureWhere);
    const fixturesRetired = await this.retireMockFixturesWithBetHistory(
      mockFixtureWhere,
    );

    const teamsRemoved = await this.prisma.team.deleteMany({
      where: {
        key: { in: [...MOCK_TEAM_KEYS] },
        homeFixtures: { none: {} },
        awayFixtures: { none: {} },
      },
    });

    if (
      fixturesRemoved > 0 ||
      fixturesRetired > 0 ||
      teamsRemoved.count > 0
    ) {
      this.logger.log(
        `Purged mock catalog: fixturesRemoved=${fixturesRemoved}, fixturesRetired=${fixturesRetired}, teams=${teamsRemoved.count}`,
      );
    }

    return {
      fixturesRemoved,
      fixturesRetired,
      fixturesSkipped,
      teamsRemoved: teamsRemoved.count,
    };
  }

  async hasLiveGames(): Promise<boolean> {
    return hasLiveGames(this.prisma);
  }

  async resolveLiveIngestSportKeys(): Promise<string[]> {
    const prestartMinutes = this.config.get('INGEST_LIVE_PRESTART_MINUTES', {
      infer: true,
    });
    return resolveLiveSportKeys(this.prisma, prestartMinutes);
  }

  /**
   * Polls only when active live games exist in the DB (optional prestart window).
   * Does not refresh the full catalog or purge fixtures when the snapshot is empty.
   */
  async ingestLiveTick(): Promise<LiveIngestionSummary> {
    return this.runIngestion('live', async () => {
      const sportKeys = await this.resolveLiveIngestSportKeys();

      if (sportKeys.length === 0) {
        this.logger.log('Live ingest skipped: no active live games in DB');
        return {
          sportKeys: [],
          skipped: true,
          sports: 0,
          leagues: 0,
          teams: 0,
          fixtures: 0,
          events: 0,
          markets: 0,
          selections: 0,
          oddsSnapshots: 0,
        };
      }

      if (!this.provider.fetchLiveSnapshot) {
        throw new Error(
          'Live ingest is not supported for the current FIXTURE_PROVIDER',
        );
      }

      const snapshot = await this.provider.fetchLiveSnapshot({ sportKeys });
      await this.upsertCatalogFromSnapshot(snapshot);
      const fixtureCount = await this.upsertFixturesFromSnapshot(snapshot, {
        purgeStale: false,
      });
      const live = await this.ingestLiveData(snapshot);
      const summary: LiveIngestionSummary = {
        ...this.buildSummary(snapshot, fixtureCount, live),
        sportKeys,
        skipped: false,
      };
      this.logIngestion('Live tick', summary, sportKeys);
      return summary;
    });
  }

  /**
   * Updates event scores/status (and closes markets when ENDED) from a partial
   * snapshot — used by bet-driven results ingest.
   */
  async applyResultsSnapshot(
    snapshot: ProviderSnapshot,
  ): Promise<{
    events: number;
    markets: number;
    selections: number;
    oddsSnapshots: number;
  }> {
    return this.ingestLiveData(snapshot);
  }

  /**
   * Ops/dev: set final score and ENDED when The Odds API no longer returns the event.
   */
  async finalizeEventResult(
    providerRef: string,
    homeScore: number,
    awayScore: number,
  ): Promise<string | null> {
    const event = await this.prisma.event.findUnique({
      where: { providerRef },
      select: { id: true, fixtureId: true },
    });
    if (!event) {
      return null;
    }

    await this.prisma.$transaction([
      this.prisma.fixture.update({
        where: { id: event.fixtureId },
        data: { status: FixtureStatus.ENDED },
      }),
      this.prisma.event.update({
        where: { id: event.id },
        data: {
          status: EventStatus.ENDED,
          homeScore,
          awayScore,
        },
      }),
    ]);
    await this.closeMarketsForEndedEvent(event.id);
    await this.prisma.bet.updateMany({
      where: {
        status: BetStatus.ACCEPTED,
        legs: { some: { eventId: event.id } },
      },
      data: { settlementNote: null },
    });
    return event.id;
  }

  private buildSummary(
    snapshot: ProviderSnapshot,
    fixtureCount: number,
    live: {
      events: number;
      markets: number;
      selections: number;
      oddsSnapshots: number;
    },
  ): IngestionSummary {
    return {
      sports: snapshot.sports.length,
      leagues: snapshot.leagues.length,
      teams: snapshot.teams.length,
      fixtures: fixtureCount,
      events: live.events,
      markets: live.markets,
      selections: live.selections,
      oddsSnapshots: live.oddsSnapshots,
    };
  }

  private logIngestion(
    label: string,
    summary: IngestionSummary,
    sportKeys?: string[],
  ): void {
    const scope =
      sportKeys && sportKeys.length > 0
        ? ` sportKeys=${sportKeys.join(',')}`
        : '';
    this.logger.log(
      `${label}:${scope} sports=${summary.sports} leagues=${summary.leagues} ` +
        `teams=${summary.teams} fixtures=${summary.fixtures} ` +
        `events=${summary.events} markets=${summary.markets} ` +
        `selections=${summary.selections} oddsSnapshots=${summary.oddsSnapshots}`,
    );
  }

  private async upsertCatalogFromSnapshot(
    snapshot: ProviderSnapshot,
  ): Promise<void> {
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
  }

  private async upsertFixturesFromSnapshot(
    snapshot: ProviderSnapshot,
    options: { purgeStale: boolean },
  ): Promise<number> {
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

    if (!options.purgeStale) {
      return fixtureCount;
    }

    const isOddsApi =
      this.config.get('FIXTURE_PROVIDER', { infer: true }) === 'odds-api';
    if (isOddsApi) {
      this.logger.debug(
        'Odds API catalog ingest is upsert-only; stale fixtures are not purged',
      );
      return fixtureCount;
    }

    // Mock ingest: purge stale mock_* only (never odds-api rows on a shared dev DB).
    const activeMockRefs = snapshot.fixtures
      .map((fixture) => fixture.providerRef)
      .filter((ref) => ref.startsWith('mock_'));
    const removedCount =
      activeMockRefs.length > 0
        ? await this.deleteStaleFixtures({
            providerRef: {
              startsWith: 'mock_',
              notIn: activeMockRefs,
            },
          })
        : 0;
    if (removedCount > 0) {
      this.logger.log(
        `Removed ${removedCount} stale mock fixture(s) not in provider snapshot`,
      );
    }

    return fixtureCount;
  }

  private fixtureHasAnyBetLegsWhere(): Prisma.FixtureWhereInput {
    return {
      event: {
        markets: {
          some: {
            selections: {
              some: { betLegs: { some: {} } },
            },
          },
        },
      },
    };
  }

  /** Fixtures with open liabilities (PENDING or ACCEPTED bets) must not be purged. */
  private fixtureHasActiveBetsWhere(): Prisma.FixtureWhereInput {
    return {
      event: {
        markets: {
          some: {
            selections: {
              some: {
                betLegs: {
                  some: {
                    bet: {
                      status: { in: [BetStatus.PENDING, BetStatus.ACCEPTED] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  /**
   * Deletes fixtures matching `where` when they have no active bets and no bet
   * history (voided/settled legs keep selections alive via FK).
   */
  private async deleteStaleFixtures(
    where: Prisma.FixtureWhereInput,
  ): Promise<number> {
    const hasActiveBets = this.fixtureHasActiveBetsWhere();
    const hasAnyBetLegs = this.fixtureHasAnyBetLegsWhere();

    const skipped = await this.prisma.fixture.count({
      where: { AND: [where, hasActiveBets] },
    });
    if (skipped > 0) {
      this.logger.log(
        `Kept ${skipped} stale fixture(s) with active bets (cannot purge while PENDING/ACCEPTED bets reference selections)`,
      );
    }

    const removed = await this.prisma.fixture.deleteMany({
      where: {
        AND: [where, { NOT: hasActiveBets }, { NOT: hasAnyBetLegs }],
      },
    });
    return removed.count;
  }

  /** Ends mock fixtures that still have bet legs so they leave the live slate. */
  private async retireMockFixturesWithBetHistory(
    where: Prisma.FixtureWhereInput,
  ): Promise<number> {
    const fixtures = await this.prisma.fixture.findMany({
      where: {
        AND: [
          where,
          { NOT: this.fixtureHasActiveBetsWhere() },
          this.fixtureHasAnyBetLegsWhere(),
        ],
      },
      select: {
        id: true,
        event: { select: { id: true } },
      },
    });

    for (const fixture of fixtures) {
      await this.prisma.$transaction(async (tx) => {
        await tx.fixture.update({
          where: { id: fixture.id },
          data: { status: FixtureStatus.ENDED },
        });
        if (fixture.event) {
          await tx.event.update({
            where: { id: fixture.event.id },
            data: { status: EventStatus.ENDED },
          });
          await tx.market.updateMany({
            where: { eventId: fixture.event.id },
            data: { status: MarketStatus.SETTLED },
          });
        }
      });
    }

    if (fixtures.length > 0) {
      this.logger.log(
        `Retired ${fixtures.length} mock fixture(s) with bet history (ended in place; bet records preserved)`,
      );
    }

    return fixtures.length;
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
      if (saved.status === EventStatus.ENDED) {
        await this.closeMarketsForEndedEvent(saved.id);
      }
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

  /** When a game ends, close DB markets so settlement can grade placed bets. */
  private async closeMarketsForEndedEvent(eventId: string): Promise<void> {
    await this.prisma.market.updateMany({
      where: { eventId },
      data: { status: MarketStatus.SETTLED },
    });
    await this.prisma.selection.updateMany({
      where: { market: { eventId } },
      data: { status: SelectionStatus.SETTLED },
    });
  }

  private async runIngestion<T>(
    kind: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = process.hrtime.bigint();
    try {
      const result = await fn();
      this.metrics.recordIngestion(
        kind,
        'success',
        this.elapsedSeconds(started),
      );
      return result;
    } catch (error) {
      this.metrics.recordIngestion(kind, 'error', this.elapsedSeconds(started));
      throw error;
    }
  }

  private elapsedSeconds(started: bigint): number {
    return Number(process.hrtime.bigint() - started) / 1e9;
  }

  /** Sync demo tenant league enablement; audit when `enabled` changes. */
  private async syncTenantLeagues(
    slug: string,
    offeredLeagueKeys: readonly string[],
  ): Promise<void> {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!group) {
      return;
    }

    const leagues = await this.prisma.league.findMany({
      select: { id: true, key: true },
    });

    for (const league of leagues) {
      const enabled = isLeagueOffered(league.key, offeredLeagueKeys);
      const existing = await this.prisma.casinoGroupLeague.findUnique({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: group.id,
            leagueId: league.id,
          },
        },
        select: { enabled: true },
      });

      await this.prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: group.id,
            leagueId: league.id,
          },
        },
        create: {
          casinoGroupId: group.id,
          leagueId: league.id,
          enabled,
        },
        update: { enabled },
      });

      if (!existing || existing.enabled !== enabled) {
        await this.audit.record({
          actorType: 'system',
          actorId: 'ingestion',
          casinoGroupId: group.id,
          action: 'tenant.league_offering_updated',
          entityType: 'CasinoGroupLeague',
          entityId: `${group.id}:${league.id}`,
          before: existing ? { enabled: existing.enabled, leagueKey: league.key } : null,
          after: { enabled, leagueKey: league.key },
          reason: `Catalog ingest sync for ${slug}`,
        });
      }
    }
  }

  private async keyToId(
    query: Promise<{ id: string; key: string }[]>,
  ): Promise<Map<string, string>> {
    const rows = await query;
    return new Map(rows.map((row) => [row.key, row.id]));
  }
}
