import { Inject, Injectable, Logger } from '@nestjs/common';
import { FixtureStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  FIXTURE_PROVIDER,
  type FixtureProviderPort,
  type NormalizedFixtureStatus,
} from '../providers/provider.types';

export interface IngestionSummary {
  sports: number;
  leagues: number;
  teams: number;
  fixtures: number;
}

const FIXTURE_STATUS_MAP: Record<NormalizedFixtureStatus, FixtureStatus> = {
  SCHEDULED: FixtureStatus.SCHEDULED,
  LIVE: FixtureStatus.LIVE,
  ENDED: FixtureStatus.ENDED,
  POSTPONED: FixtureStatus.POSTPONED,
  CANCELLED: FixtureStatus.CANCELLED,
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIXTURE_PROVIDER) private readonly provider: FixtureProviderPort,
  ) {}

  /**
   * Pulls the provider snapshot and upserts catalog + fixtures by their unique
   * keys, so repeated runs are idempotent.
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

    const summary: IngestionSummary = {
      sports: snapshot.sports.length,
      leagues: snapshot.leagues.length,
      teams: snapshot.teams.length,
      fixtures: fixtureCount,
    };
    this.logger.log(
      `Ingested sports=${summary.sports} leagues=${summary.leagues} teams=${summary.teams} fixtures=${summary.fixtures}`,
    );
    return summary;
  }

  private async keyToId(
    query: Promise<{ id: string; key: string }[]>,
  ): Promise<Map<string, string>> {
    const rows = await query;
    return new Map(rows.map((row) => [row.key, row.id]));
  }
}
