import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffRole, StaffUserStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { hasStaffRole } from './staff-permissions';

@Injectable()
export class StaffAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPlatformAdmins() {
    const users = await this.prisma.staffUser.findMany({
      where: {
        casinoGroupId: null,
        status: StaffUserStatus.ACTIVE,
        roles: { has: StaffRole.PLATFORM_ADMIN },
      },
      select: {
        id: true,
        email: true,
        roles: true,
        status: true,
        tenantAccess: {
          select: {
            casinoGroup: {
              select: { id: true, slug: true, name: true, status: true },
            },
          },
          orderBy: { casinoGroup: { name: 'asc' } },
        },
      },
      orderBy: { email: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      roles: user.roles.map(String),
      status: user.status,
      casinoGroups: user.tenantAccess.map((row) => row.casinoGroup),
    }));
  }

  async setPlatformAdminTenantAccess(
    staffUserId: string,
    casinoGroupIds: string[],
    actorStaffUserId: string,
  ) {
    const user = await this.prisma.staffUser.findUnique({
      where: { id: staffUserId },
      select: {
        id: true,
        email: true,
        casinoGroupId: true,
        roles: true,
        tenantAccess: { select: { casinoGroupId: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Staff user not found');
    }
    if (user.casinoGroupId) {
      throw new BadRequestException(
        'Tenant access grants apply only to platform-scoped PLATFORM_ADMIN users',
      );
    }
    if (!hasStaffRole(user.roles, StaffRole.PLATFORM_ADMIN)) {
      throw new BadRequestException('Staff user must have PLATFORM_ADMIN role');
    }

    const groups = await this.prisma.casinoGroup.findMany({
      where: { id: { in: casinoGroupIds } },
      select: { id: true },
    });
    if (groups.length !== casinoGroupIds.length) {
      throw new NotFoundException('One or more casino groups not found');
    }

    const before = user.tenantAccess.map((row) => row.casinoGroupId);

    await this.prisma.$transaction(async (tx) => {
      await tx.staffCasinoGroupAccess.deleteMany({
        where: { staffUserId },
      });
      if (casinoGroupIds.length > 0) {
        await tx.staffCasinoGroupAccess.createMany({
          data: casinoGroupIds.map((casinoGroupId) => ({
            staffUserId,
            casinoGroupId,
          })),
        });
      }
    });

    await this.audit.record({
      actorType: 'staff',
      actorId: actorStaffUserId,
      casinoGroupId: null,
      action: 'staff.tenant_access.updated',
      entityType: 'StaffUser',
      entityId: staffUserId,
      before: { casinoGroupIds: before },
      after: { casinoGroupIds },
      reason: `Platform admin tenant access for ${user.email}`,
    });

    const updated = await this.prisma.staffUser.findUniqueOrThrow({
      where: { id: staffUserId },
      select: {
        id: true,
        email: true,
        tenantAccess: {
          select: {
            casinoGroup: {
              select: { id: true, slug: true, name: true, status: true },
            },
          },
        },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      casinoGroups: updated.tenantAccess.map((row) => row.casinoGroup),
    };
  }
}
