import { ForbiddenException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { StaffContext } from './staff-context.types';
import { hasStaffRole, isPlatformScopeRole } from './staff-permissions';

/** Cross-tenant platform operators only (SUPER_ADMIN or PLATFORM_ADMIN). */
export function assertPlatformStaff(staff: StaffContext): void {
  if (staff.casinoGroupId) {
    throw new ForbiddenException(
      'Only platform operators can perform this action',
    );
  }
  if (!isPlatformScopeRole(staff.roles)) {
    throw new ForbiddenException(
      'Requires SUPER_ADMIN or PLATFORM_ADMIN platform role',
    );
  }
}

/** Platform super-user only (staff IAM, break-glass). */
export function assertSuperAdmin(staff: StaffContext): void {
  assertPlatformStaff(staff);
  if (!hasStaffRole(staff.roles, StaffRole.SUPER_ADMIN)) {
    throw new ForbiddenException('Requires SUPER_ADMIN role');
  }
}

/** Tenant-bound staff only. */
export function assertTenantStaff(staff: StaffContext): void {
  if (!staff.casinoGroupId) {
    throw new ForbiddenException(
      'This action is only available to tenant-scoped staff',
    );
  }
}

