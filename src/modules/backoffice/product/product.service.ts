import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { EnvConfig } from '../../../shared/config/env.validation';
import { resolveCatalogLeagueKeys } from '../../providers/odds-api/odds-api.config';
import type { StaffContext } from '../staff/staff-context.types';
import { isPlatformStaff } from '../staff/staff-platform.util';
import { UpdateLeaguesDto } from './dto/update-leagues.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async listLeagues(casinoGroupId: string) {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Casino group not found');
    }

    const allowedKeys = await this.allowedCatalogLeagueKeys();
    if (allowedKeys.length === 0) {
      return [];
    }

    const leagues = await this.prisma.league.findMany({
      where: { active: true, key: { in: allowedKeys } },
      select: {
        id: true,
        key: true,
        name: true,
        region: true,
        sport: { select: { key: true, name: true } },
        groups: {
          where: { casinoGroupId },
          select: { enabled: true, platformLocked: true },
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
      enabled: league.groups[0]?.enabled ?? true,
      platformLocked: league.groups[0]?.platformLocked ?? false,
    }));
  }

  async updateLeagues(
    casinoGroupId: string,
    dto: UpdateLeaguesDto,
    staff: StaffContext,
  ) {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Casino group not found');
    }

    const allowedKeys = new Set(await this.allowedCatalogLeagueKeys());
    const platformActor = isPlatformStaff(staff);

    for (const item of dto.leagues) {
      const league = await this.prisma.league.findUnique({
        where: { id: item.leagueId },
        select: {
          id: true,
          key: true,
          active: true,
          sport: { select: { active: true } },
        },
      });
      if (!league) {
        throw new NotFoundException(`League ${item.leagueId} not found`);
      }
      if (!allowedKeys.has(league.key)) {
        throw new BadRequestException(
          `League ${league.key} is outside the configured catalog ingest scope (ODDS_API_SPORT_KEYS)`,
        );
      }

      const existing = await this.prisma.casinoGroupLeague.findUnique({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId,
            leagueId: item.leagueId,
          },
        },
      });

      const catalogActive = league.active && league.sport.active;

      if (!platformActor) {
        if (item.enabled && existing?.platformLocked) {
          throw new BadRequestException(
            `${league.key} was disabled by platform administrators and cannot be re-enabled`,
          );
        }
        if (item.enabled && !catalogActive) {
          throw new BadRequestException(
            `${league.key} is disabled at the platform catalog level and cannot be enabled`,
          );
        }

        await this.persistOffering({
          casinoGroupId,
          leagueId: item.leagueId,
          leagueKey: league.key,
          staffUserId: staff.staffUserId,
          existing,
          enabled: item.enabled,
          platformLocked: existing?.platformLocked ?? false,
          operatorOnly: true,
        });
        continue;
      }

      if (item.enabled && !catalogActive) {
        throw new BadRequestException(
          `${league.key} is disabled at the platform catalog level and cannot be enabled`,
        );
      }

      const platformLocked = !item.enabled;
      const enabled = item.enabled;

      await this.persistOffering({
        casinoGroupId,
        leagueId: item.leagueId,
        leagueKey: league.key,
        staffUserId: staff.staffUserId,
        existing,
        enabled,
        platformLocked,
      });
    }

    return this.listLeagues(casinoGroupId);
  }

  private async persistOffering(input: {
    casinoGroupId: string;
    leagueId: string;
    leagueKey: string;
    staffUserId: string;
    existing: { enabled: boolean; platformLocked: boolean } | null;
    enabled: boolean;
    platformLocked: boolean;
    operatorOnly?: boolean;
  }) {
    const {
      casinoGroupId,
      leagueId,
      leagueKey,
      staffUserId,
      existing,
      enabled,
      platformLocked,
    } = input;

    await this.prisma.casinoGroupLeague.upsert({
      where: {
        casinoGroupId_leagueId: { casinoGroupId, leagueId },
      },
      create: { casinoGroupId, leagueId, enabled, platformLocked },
      update: input.operatorOnly
        ? { enabled }
        : { enabled, platformLocked },
    });

    const changed = input.operatorOnly
      ? !existing || existing.enabled !== enabled
      : !existing ||
        existing.enabled !== enabled ||
        existing.platformLocked !== platformLocked;

    if (changed) {
      await this.audit.record({
        actorType: 'staff',
        actorId: staffUserId,
        casinoGroupId,
        action: 'product.league_offering_updated',
        entityType: 'CasinoGroupLeague',
        entityId: `${casinoGroupId}:${leagueId}`,
        before: existing
          ? {
              enabled: existing.enabled,
              platformLocked: existing.platformLocked,
              leagueKey,
            }
          : null,
        after: { enabled, platformLocked, leagueKey },
      });
    }
  }

  private async allowedCatalogLeagueKeys(): Promise<string[]> {
    const catalogKeys = await this.prisma.league.findMany({
      where: { active: true },
      select: { key: true },
    });
    const configured = this.config.get('ODDS_API_SPORT_KEYS', { infer: true });
    return resolveCatalogLeagueKeys(
      configured,
      catalogKeys.map((row) => row.key),
    );
  }
}
