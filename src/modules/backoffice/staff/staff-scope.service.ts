import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { StaffContext } from './staff-context.types';
import { hasStaffRole, isPlatformScopeRole } from './staff-permissions';

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: string;
}

@Injectable()
export class StaffScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccessibleTenants(staff: StaffContext): Promise<TenantListItem[]> {
    if (staff.casinoGroupId) {
      const group = await this.prisma.casinoGroup.findUnique({
        where: { id: staff.casinoGroupId },
        select: { id: true, slug: true, name: true, status: true },
      });
      return group ? [group] : [];
    }

    if (!isPlatformScopeRole(staff.roles)) {
      return [];
    }

    if (hasStaffRole(staff.roles, StaffRole.SUPER_ADMIN)) {
      return this.prisma.casinoGroup.findMany({
        select: { id: true, slug: true, name: true, status: true },
        orderBy: { name: 'asc' },
      });
    }

    if (hasStaffRole(staff.roles, StaffRole.PLATFORM_ADMIN)) {
      const rows = await this.prisma.staffCasinoGroupAccess.findMany({
        where: { staffUserId: staff.staffUserId },
        select: {
          casinoGroup: {
            select: { id: true, slug: true, name: true, status: true },
          },
        },
        orderBy: { casinoGroup: { name: 'asc' } },
      });
      return rows.map((row) => row.casinoGroup);
    }

    return [];
  }

  async assertCasinoGroupAccess(
    staff: StaffContext,
    casinoGroupId: string,
  ): Promise<void> {
    const group = await this.prisma.casinoGroup.findUnique({
      where: { id: casinoGroupId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Casino group not found');
    }

    if (staff.casinoGroupId) {
      if (staff.casinoGroupId !== casinoGroupId) {
        throw new ForbiddenException('Cannot access another casino group');
      }
      return;
    }

    if (!isPlatformScopeRole(staff.roles)) {
      throw new ForbiddenException('Cannot access this casino group');
    }

    if (hasStaffRole(staff.roles, StaffRole.SUPER_ADMIN)) {
      return;
    }

    if (hasStaffRole(staff.roles, StaffRole.PLATFORM_ADMIN)) {
      const grant = await this.prisma.staffCasinoGroupAccess.findUnique({
        where: {
          staffUserId_casinoGroupId: {
            staffUserId: staff.staffUserId,
            casinoGroupId,
          },
        },
      });
      if (!grant) {
        throw new ForbiddenException(
          'You are not authorized to access this casino group',
        );
      }
      return;
    }

    throw new ForbiddenException('Cannot access this casino group');
  }

  async resolveCasinoGroupId(
    staff: StaffContext,
    requestedGroupId?: string,
  ): Promise<string> {
    if (staff.casinoGroupId) {
      if (requestedGroupId && requestedGroupId !== staff.casinoGroupId) {
        throw new ForbiddenException('Cannot access another casino group');
      }
      return staff.casinoGroupId;
    }

    if (!requestedGroupId) {
      throw new BadRequestException(
        'Query parameter casinoGroupId is required for platform operators',
      );
    }

    await this.assertCasinoGroupAccess(staff, requestedGroupId);
    return requestedGroupId;
  }
}
