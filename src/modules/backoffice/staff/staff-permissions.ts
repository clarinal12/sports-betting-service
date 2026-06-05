import { StaffRole } from '@prisma/client';

export const STAFF_PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'tenant.create',
  'product.leagues.read',
  'product.leagues.update',
  'staff.read',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  OPERATOR_ADMIN: [...STAFF_PERMISSIONS],
  TRADER: ['tenant.read', 'product.leagues.read', 'product.leagues.update'],
  RISK_MANAGER: ['tenant.read', 'product.leagues.read'],
  CUSTOMER_SUPPORT: ['tenant.read', 'product.leagues.read'],
  SETTLEMENT: ['tenant.read', 'product.leagues.read'],
  FINANCE: ['tenant.read', 'product.leagues.read'],
  COMPLIANCE: ['tenant.read', 'staff.read'],
};

export function permissionsForRoles(roles: StaffRole[]): StaffPermission[] {
  const set = new Set<StaffPermission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      set.add(permission);
    }
  }
  return [...set];
}

export function hasPermission(
  permissions: readonly string[],
  required: StaffPermission,
): boolean {
  return permissions.includes(required);
}
