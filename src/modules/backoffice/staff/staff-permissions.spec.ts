import { StaffRole } from '@prisma/client';
import { permissionsForRoles } from './staff-permissions';

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
});
