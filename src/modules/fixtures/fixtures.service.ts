import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { PaginatedDto, paginate } from '../../shared/dto/pagination';
import { FixtureResponseDto } from './dto/fixture-response.dto';
import { ListFixturesQueryDto } from './dto/list-fixtures-query.dto';

@Injectable()
export class FixturesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fixtures restricted to leagues the tenant has enabled. Tenant scoping is
   * enforced here (data layer), never trusted from the controller/query.
   */
  async listForGroup(
    casinoGroupId: string,
    query: ListFixturesQueryDto,
  ): Promise<PaginatedDto<FixtureResponseDto>> {
    const startsAt = this.buildDateRange(query.from, query.to);

    const where: Prisma.FixtureWhereInput = {
      league: {
        active: true,
        groups: { some: { casinoGroupId, enabled: true } },
        ...(query.leagueId ? { id: query.leagueId } : {}),
      },
      ...(query.status ? { status: query.status } : {}),
      ...(startsAt ? { startsAt } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.fixture.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          leagueId: true,
          startsAt: true,
          status: true,
          homeTeam: { select: { id: true, name: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, shortName: true } },
        },
      }),
      this.prisma.fixture.count({ where }),
    ]);

    const data: FixtureResponseDto[] = rows.map((row) => ({
      id: row.id,
      leagueId: row.leagueId,
      startsAt: row.startsAt.toISOString(),
      status: row.status,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
    }));

    return paginate(data, total, query);
  }

  private buildDateRange(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) {
      return undefined;
    }
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
}
