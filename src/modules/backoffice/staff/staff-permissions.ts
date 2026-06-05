import { StaffRole } from '@prisma/client';

export const STAFF_PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'tenant.create',
  'product.leagues.read',
  'product.leagues.update',
  'staff.read',
  'trading.read',
  'trading.suspend',
  'trading.limits.read',
  'trading.limits.update',
  'bets.read',
  'bets.void',
  'settlement.read',
  'analytics.read',
  'compliance.audit.read',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  OPERATOR_ADMIN: [...STAFF_PERMISSIONS],
  TRADER: [
    'tenant.read',
    'product.leagues.read',
    'product.leagues.update',
    'trading.read',
    'trading.suspend',
    'trading.limits.read',
    'bets.read',
    'settlement.read',
  ],
  RISK_MANAGER: [
    'tenant.read',
    'product.leagues.read',
    'trading.read',
    'trading.limits.read',
    'trading.limits.update',
    'bets.read',
    'analytics.read',
  ],
  CUSTOMER_SUPPORT: [
    'tenant.read',
    'product.leagues.read',
    'bets.read',
    'bets.void',
    'compliance.audit.read',
  ],
  SETTLEMENT: [
    'tenant.read',
    'product.leagues.read',
    'bets.read',
    'settlement.read',
    'compliance.audit.read',
  ],
  FINANCE: [
    'tenant.read',
    'product.leagues.read',
    'bets.read',
    'analytics.read',
    'compliance.audit.read',
  ],
  COMPLIANCE: ['tenant.read', 'staff.read', 'compliance.audit.read', 'bets.read'],
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
