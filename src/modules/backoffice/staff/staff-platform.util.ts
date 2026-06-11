import type { StaffContext } from './staff-context.types';

/** Platform-scoped staff (not bound to a single tenant). */
export function isPlatformStaff(staff: StaffContext): boolean {
  return staff.casinoGroupId == null;
}
