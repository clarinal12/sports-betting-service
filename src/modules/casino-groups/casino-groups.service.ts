import { Injectable } from '@nestjs/common';
import { CasinoGroupStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../shared/cache/redis.service';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { CasinoGroupContext } from './casino-group.types';

const CACHE_PREFIX = 'casino-group:slug:';
const CACHE_ID_PREFIX = 'casino-group:id:';
const CACHE_TTL_SECONDS = 60;

const GROUP_SELECT = {
  id: true,
  slug: true,
  name: true,
  defaultCurrency: true,
  timezone: true,
} as const;

export interface MerchantCredentials {
  group: CasinoGroupContext;
  sportsSecret: string;
}

@Injectable()
export class CasinoGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Resolves an active casino group by slug, with a short-lived Redis cache.
   * Returns null when the group is unknown or disabled.
   */
  async resolveActiveBySlug(slug: string): Promise<CasinoGroupContext | null> {
    const cached = await this.readCache(`${CACHE_PREFIX}${slug}`);
    if (cached) {
      return cached;
    }

    const group = await this.prisma.casinoGroup.findFirst({
      where: { slug, status: CasinoGroupStatus.ACTIVE },
      select: GROUP_SELECT,
    });

    if (!group) {
      return null;
    }

    await this.writeCache(`${CACHE_PREFIX}${slug}`, group);
    return group;
  }

  /**
   * Resolves an active casino group by internal id (used after verifying a
   * session token whose claim carries the casinoGroupId).
   */
  async resolveActiveById(id: string): Promise<CasinoGroupContext | null> {
    const cached = await this.readCache(`${CACHE_ID_PREFIX}${id}`);
    if (cached) {
      return cached;
    }

    const group = await this.prisma.casinoGroup.findFirst({
      where: { id, status: CasinoGroupStatus.ACTIVE },
      select: GROUP_SELECT,
    });

    if (!group) {
      return null;
    }

    await this.writeCache(`${CACHE_ID_PREFIX}${id}`, group);
    return group;
  }

  /**
   * Resolves an active merchant and its decrypted launch-token secret.
   * Not cached (the secret is sensitive). Returns null when unknown/inactive
   * or no secret is configured.
   */
  async getMerchantCredentials(
    merchantId: string,
  ): Promise<MerchantCredentials | null> {
    const row = await this.prisma.casinoGroup.findFirst({
      where: { merchantId, status: CasinoGroupStatus.ACTIVE },
      select: { ...GROUP_SELECT, sportsSecret: true },
    });

    if (!row || !row.sportsSecret) {
      return null;
    }

    const { sportsSecret, ...group } = row;
    return { group, sportsSecret: this.crypto.decrypt(sportsSecret) };
  }

  async invalidate(group: CasinoGroupContext): Promise<void> {
    await this.redis
      .getClient()
      .del(`${CACHE_PREFIX}${group.slug}`, `${CACHE_ID_PREFIX}${group.id}`);
  }

  private async readCache(key: string): Promise<CasinoGroupContext | null> {
    try {
      const raw = await this.redis.getClient().get(key);
      return raw ? (JSON.parse(raw) as CasinoGroupContext) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(
    key: string,
    group: CasinoGroupContext,
  ): Promise<void> {
    try {
      await this.redis
        .getClient()
        .set(key, JSON.stringify(group), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Cache is best-effort; a Redis hiccup must not block resolution.
    }
  }
}
