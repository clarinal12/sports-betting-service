import { Injectable } from '@nestjs/common';
import { CasinoGroupStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../shared/cache/redis.service';
import { CasinoGroupContext } from './casino-group.types';

const CACHE_PREFIX = 'casino-group:slug:';
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class CasinoGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Resolves an active casino group by slug, with a short-lived Redis cache.
   * Returns null when the group is unknown or disabled.
   */
  async resolveActiveBySlug(slug: string): Promise<CasinoGroupContext | null> {
    const cached = await this.readCache(slug);
    if (cached) {
      return cached;
    }

    const group = await this.prisma.casinoGroup.findFirst({
      where: { slug, status: CasinoGroupStatus.ACTIVE },
      select: {
        id: true,
        slug: true,
        name: true,
        defaultCurrency: true,
        timezone: true,
      },
    });

    if (!group) {
      return null;
    }

    await this.writeCache(group);
    return group;
  }

  async invalidate(slug: string): Promise<void> {
    await this.redis.getClient().del(`${CACHE_PREFIX}${slug}`);
  }

  private async readCache(slug: string): Promise<CasinoGroupContext | null> {
    try {
      const raw = await this.redis.getClient().get(`${CACHE_PREFIX}${slug}`);
      return raw ? (JSON.parse(raw) as CasinoGroupContext) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(group: CasinoGroupContext): Promise<void> {
    try {
      await this.redis
        .getClient()
        .set(
          `${CACHE_PREFIX}${group.slug}`,
          JSON.stringify(group),
          'EX',
          CACHE_TTL_SECONDS,
        );
    } catch {
      // Cache is best-effort; a Redis hiccup must not block resolution.
    }
  }
}
