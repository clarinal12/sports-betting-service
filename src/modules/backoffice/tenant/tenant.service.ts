import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { PatchTenantDto } from './dto/patch-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getTenant(casinoGroupId: string) {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: {
        id: true,
        slug: true,
        name: true,
        defaultCurrency: true,
        timezone: true,
        status: true,
        merchantId: true,
        createdAt: true,
        updatedAt: true,
      },
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
      },
      select: {
        id: true,
        slug: true,
        name: true,
        defaultCurrency: true,
        timezone: true,
        status: true,
        merchantId: true,
        createdAt: true,
        updatedAt: true,
      },
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
