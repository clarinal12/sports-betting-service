import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CasinoGroupStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { NBA_LEAGUE_KEY } from '../../casino-groups/tenant-offering.config';
import { isLeagueOffered } from '../../casino-groups/tenant-offering.config';
import { CryptoService } from '../../../shared/crypto/crypto.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async createMerchant(dto: CreateMerchantDto, staffUserId: string) {
    const sportsSecretPlain =
      dto.sportsSecret ?? randomBytes(32).toString('base64url');
    const offeredKeys = dto.enabledLeagueKeys?.length
      ? dto.enabledLeagueKeys
      : [NBA_LEAGUE_KEY];

    try {
      const group = await this.prisma.$transaction(async (tx) => {
        const created = await tx.casinoGroup.create({
          data: {
            slug: dto.slug,
            name: dto.name,
            merchantId: dto.merchantId,
            defaultCurrency: dto.defaultCurrency ?? 'USD',
            status: CasinoGroupStatus.ACTIVE,
            sportsSecret: this.crypto.encrypt(sportsSecretPlain),
          },
        });

        const leagues = await tx.league.findMany({
          select: { id: true, key: true },
        });
        for (const league of leagues) {
          const enabled = isLeagueOffered(league.key, offeredKeys);
          await tx.casinoGroupLeague.upsert({
            where: {
              casinoGroupId_leagueId: {
                casinoGroupId: created.id,
                leagueId: league.id,
              },
            },
            create: {
              casinoGroupId: created.id,
              leagueId: league.id,
              enabled,
            },
            update: { enabled },
          });
        }

        await tx.offeringPolicy.create({
          data: { casinoGroupId: created.id, rules: { enabledLeagueKeys: offeredKeys } },
        });

        await tx.riskLimit.upsert({
          where: {
            casinoGroupId_scope_scopeRef: {
              casinoGroupId: created.id,
              scope: 'GLOBAL',
              scopeRef: '',
            },
          },
          create: {
            casinoGroupId: created.id,
            scope: 'GLOBAL',
            scopeRef: '',
          },
          update: {},
        });

        return created;
      });

      await this.audit.record({
        actorType: 'staff',
        actorId: staffUserId,
        casinoGroupId: group.id,
        action: 'tenant.merchant_created',
        entityType: 'CasinoGroup',
        entityId: group.id,
        after: {
          slug: group.slug,
          merchantId: group.merchantId,
          enabledLeagueKeys: offeredKeys,
        },
        reason: 'Back office merchant onboarding',
      });

      return {
        id: group.id,
        slug: group.slug,
        name: group.name,
        merchantId: group.merchantId,
        defaultCurrency: group.defaultCurrency,
        status: group.status,
        sportsSecret: sportsSecretPlain,
        enabledLeagueKeys: offeredKeys,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Slug or merchantId already exists');
      }
      throw error;
    }
  }
}
