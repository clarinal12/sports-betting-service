import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StaffRole, StaffUserStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { hasStaffRole } from './staff-permissions';
import { StaffAuthService } from './staff-auth.service';
import { StaffScopeService } from './staff-scope.service';
import { StaffContext } from './staff-context.types';
import { assertPlatformStaff } from './staff-scope.util';
import { UpdateOperatorStaffDto } from './dto/update-operator-staff.dto';

@Injectable()
export class StaffAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly staffAuth: StaffAuthService,
    private readonly staffScope: StaffScopeService,
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

  async listOperatorAdmins(actor: StaffContext, casinoGroupId: string) {
    assertPlatformStaff(actor);
    await this.staffScope.assertCasinoGroupAccess(actor, casinoGroupId);

    const users = await this.prisma.staffUser.findMany({
      where: {
        casinoGroupId,
        roles: { has: StaffRole.OPERATOR_ADMIN },
        status: StaffUserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        roles: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { email: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      roles: user.roles.map(String),
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));
  }

  async updateOperatorAdmin(
    actor: StaffContext,
    staffUserId: string,
    casinoGroupId: string,
    dto: UpdateOperatorStaffDto,
  ) {
    assertPlatformStaff(actor);
    await this.staffScope.assertCasinoGroupAccess(actor, casinoGroupId);

    const email = dto.email?.trim().toLowerCase();
    const password = dto.password?.trim();
    if (!email && !password) {
      throw new BadRequestException(
        'Provide at least one of email or password to update',
      );
    }

    const existing = await this.prisma.staffUser.findUnique({
      where: { id: staffUserId },
      select: {
        id: true,
        email: true,
        casinoGroupId: true,
        roles: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Staff user not found');
    }
    if (
      existing.casinoGroupId !== casinoGroupId ||
      !hasStaffRole(existing.roles, StaffRole.OPERATOR_ADMIN)
    ) {
      throw new NotFoundException('Operator admin not found for this tenant');
    }

    const data: Prisma.StaffUserUpdateInput = {};
    if (email) {
      data.email = email;
    }
    if (password) {
      data.passwordHash = await this.staffAuth.hashPassword(password);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.staffUser.update({
          where: { id: staffUserId },
          data,
        });
        if (password) {
          await tx.staffSession.deleteMany({ where: { staffUserId } });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }

    await this.audit.record({
      actorType: 'staff',
      actorId: actor.staffUserId,
      casinoGroupId,
      action: 'staff.operator_updated',
      entityType: 'StaffUser',
      entityId: staffUserId,
      before: { email: existing.email },
      after: {
        email: email ?? existing.email,
        passwordChanged: Boolean(password),
      },
      reason: 'Platform staff updated merchant operator credentials',
    });

    const updated = await this.prisma.staffUser.findUniqueOrThrow({
      where: { id: staffUserId },
      select: {
        id: true,
        email: true,
        roles: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      roles: updated.roles.map(String),
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
