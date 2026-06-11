import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { CasinoGroupsService } from '../../casino-groups/casino-groups.service';
import { normalizeWalletApiUrl } from '../../wallet/wallet-auth.util';
import { PatchTenantDto } from './dto/patch-tenant.dto';

const TENANT_SELECT = {
  id: true,
  slug: true,
  name: true,
  defaultCurrency: true,
  timezone: true,
  status: true,
  merchantId: true,
  walletApiUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly casinoGroups: CasinoGroupsService,
  ) {}

  async getTenant(casinoGroupId: string) {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: TENANT_SELECT,
    });
    if (!group) {
      throw new NotFoundException('Casino group not found');
    }
    return group;
  }

  async patchTenant(
    casinoGroupId: string,
    dto: PatchTenantDto,
    staffUserId: string,
  ) {
    const before = await this.getTenant(casinoGroupId);
    const updated = await this.prisma.casinoGroup.update({
      where: { id: casinoGroupId },
      data: {
        name: dto.name,
        defaultCurrency: dto.defaultCurrency,
        timezone: dto.timezone,
        status: dto.status,
        ...(dto.walletApiUrl !== undefined
          ? {
              walletApiUrl: dto.walletApiUrl
                ? normalizeWalletApiUrl(dto.walletApiUrl)
                : null,
            }
          : {}),
      },
      select: TENANT_SELECT,
    });

    await this.casinoGroups.invalidate({
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      defaultCurrency: updated.defaultCurrency,
      timezone: updated.timezone,
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: staffUserId,
      casinoGroupId,
      action: 'tenant.updated',
      entityType: 'CasinoGroup',
      entityId: casinoGroupId,
      before,
      after: updated,
    });

    return updated;
  }
}
