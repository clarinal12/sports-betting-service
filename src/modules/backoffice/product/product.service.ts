import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { UpdateLeaguesDto } from './dto/update-leagues.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listLeagues(casinoGroupId: string) {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Casino group not found');
    }

    const leagues = await this.prisma.league.findMany({
      where: { active: true },
      select: {
        id: true,
        key: true,
        name: true,
        region: true,
        sport: { select: { key: true, name: true } },
        groups: {
          where: { casinoGroupId },
          select: { enabled: true },
        },
      },
      orderBy: [{ sport: { name: 'asc' } }, { name: 'asc' }],
    });

    return leagues.map((league) => ({
      leagueId: league.id,
      key: league.key,
      name: league.name,
      region: league.region,
      sportKey: league.sport.key,
      sportName: league.sport.name,
      enabled: league.groups[0]?.enabled ?? false,
    }));
  }

  async updateLeagues(
    casinoGroupId: string,
    dto: UpdateLeaguesDto,
    staffUserId: string,
  ) {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Casino group not found');
    }

    const results: { leagueId: string; key: string; enabled: boolean }[] = [];
    for (const item of dto.leagues) {
      const league = await this.prisma.league.findUnique({
        where: { id: item.leagueId },
        select: { id: true, key: true },
      });
      if (!league) {
        throw new NotFoundException(`League ${item.leagueId} not found`);
      }

      const existing = await this.prisma.casinoGroupLeague.findUnique({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId,
            leagueId: item.leagueId,
          },
        },
      });

      await this.prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId,
            leagueId: item.leagueId,
          },
        },
        create: {
          casinoGroupId,
          leagueId: item.leagueId,
          enabled: item.enabled,
        },
        update: { enabled: item.enabled },
      });

      if (!existing || existing.enabled !== item.enabled) {
        await this.audit.record({
          actorType: 'staff',
          actorId: staffUserId,
          casinoGroupId,
          action: 'product.league_offering_updated',
          entityType: 'CasinoGroupLeague',
          entityId: `${casinoGroupId}:${item.leagueId}`,
          before: existing ? { enabled: existing.enabled, leagueKey: league.key } : null,
          after: { enabled: item.enabled, leagueKey: league.key },
        });
      }

      results.push({
        leagueId: item.leagueId,
        key: league.key,
        enabled: item.enabled,
      });
    }

    return { casinoGroupId, leagues: results };
  }
}
