import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { LeagueResponseDto } from './dto/league-response.dto';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Leagues enabled for this tenant, optionally filtered by sport.
   */
  async listForGroup(
    casinoGroupId: string,
    sportId?: string,
  ): Promise<LeagueResponseDto[]> {
    const where: Prisma.LeagueWhereInput = {
      active: true,
      groups: { some: { casinoGroupId, enabled: true } },
      ...(sportId ? { sportId } : {}),
    };

    const leagues = await this.prisma.league.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true, region: true, sportId: true },
    });
    return leagues;
  }
}
