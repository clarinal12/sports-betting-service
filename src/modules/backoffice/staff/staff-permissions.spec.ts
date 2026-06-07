import { StaffRole } from '@prisma/client';
import {
  isPlatformScopeRole,
  permissionsForRoles,
} from './staff-permissions';

describe('staff-permissions', () => {
  it('trader can suspend but not void bets', () => {
    const perms = permissionsForRoles([StaffRole.TRADER]);
    expect(perms).toContain('trading.suspend');
    expect(perms).not.toContain('bets.void');
  });

  it('customer support can void bets', () => {
    const perms = permissionsForRoles([StaffRole.CUSTOMER_SUPPORT]);
    expect(perms).toContain('bets.void');
  });

  it('super admin has full permissions including staff IAM', () => {
    const perms = permissionsForRoles([StaffRole.SUPER_ADMIN]);
    expect(perms).toContain('tenant.create');
    expect(perms).toContain('staff.read');
    expect(perms).toContain('staff.tenant_access.update');
  });

  it('platform admin can onboard merchants and manage operator accounts', () => {
    const perms = permissionsForRoles([StaffRole.PLATFORM_ADMIN]);
    expect(perms).toContain('tenant.create');
    expect(perms).not.toContain('staff.read');
    expect(perms).toContain('staff.operator.read');
    expect(perms).toContain('staff.operator.update');
  });

  it('tenant operator admin cannot onboard merchants or read staff IAM', () => {
    const perms = permissionsForRoles([StaffRole.OPERATOR_ADMIN]);
    expect(perms).not.toContain('tenant.create');
    expect(perms).not.toContain('staff.read');
    expect(perms).not.toContain('settlement.run');
    expect(perms).toContain('tenant.update');
    expect(perms).toContain('settlement.read');
  });

  it('settlement role can view queue but not run settlement', () => {
    const perms = permissionsForRoles([StaffRole.SETTLEMENT]);
    expect(perms).toContain('settlement.read');
    expect(perms).not.toContain('settlement.run');
  });

  it('platform admin can run settlement', () => {
    const perms = permissionsForRoles([StaffRole.PLATFORM_ADMIN]);
    expect(perms).toContain('settlement.run');
  });

  it('identifies platform scope roles', () => {
    expect(isPlatformScopeRole([StaffRole.SUPER_ADMIN])).toBe(true);
    expect(isPlatformScopeRole([StaffRole.PLATFORM_ADMIN])).toBe(true);
    expect(isPlatformScopeRole([StaffRole.OPERATOR_ADMIN])).toBe(false);
  });
});
