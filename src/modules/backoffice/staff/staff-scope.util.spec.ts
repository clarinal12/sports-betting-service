import { StaffRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import {
  assertPlatformStaff,
  assertSuperAdmin,
} from './staff-scope.util';
import type { StaffContext } from './staff-context.types';

function ctx(
  partial: Partial<StaffContext> & Pick<StaffContext, 'roles'>,
): StaffContext {
  return {
    staffUserId: 'staff-1',
    email: 'test@example.com',
    casinoGroupId: null,
    permissions: [],
    ...partial,
  };
}

describe('staff-scope.util', () => {
  it('allows platform admin with null casinoGroupId', () => {
    expect(() =>
      assertPlatformStaff(
        ctx({ roles: [StaffRole.PLATFORM_ADMIN], casinoGroupId: null }),
      ),
    ).not.toThrow();
  });

  it('rejects tenant operator for platform actions', () => {
    expect(() =>
      assertPlatformStaff(
        ctx({
          roles: [StaffRole.OPERATOR_ADMIN],
          casinoGroupId: 'group-1',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires SUPER_ADMIN for super-only guard', () => {
    expect(() =>
      assertSuperAdmin(
        ctx({ roles: [StaffRole.PLATFORM_ADMIN], casinoGroupId: null }),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      assertSuperAdmin(
        ctx({ roles: [StaffRole.SUPER_ADMIN], casinoGroupId: null }),
      ),
    ).not.toThrow();
  });
});
