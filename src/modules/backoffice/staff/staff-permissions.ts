import { StaffRole } from '@prisma/client';

export const STAFF_PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'tenant.create',
  'product.leagues.read',
  'product.leagues.update',
  'staff.read',
  'staff.tenant_access.read',
  'staff.tenant_access.update',
  'trading.read',
  'trading.suspend',
  'trading.limits.read',
  'trading.limits.update',
  'bets.read',
  'bets.void',
  'settlement.read',
  'settlement.run',
  'analytics.read',
  'compliance.audit.read',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/** Cross-tenant fleet operations (no platform IAM). */
const PLATFORM_OPS_PERMISSIONS: StaffPermission[] = [
  'tenant.read',
  'tenant.create',
  'tenant.update',
  'product.leagues.read',
  'product.leagues.update',
  'trading.read',
  'trading.suspend',
  'trading.limits.read',
  'trading.limits.update',
  'bets.read',
  'bets.void',
  'settlement.read',
  'settlement.run',
  'analytics.read',
  'compliance.audit.read',
];

/** Full admin within one casino group — cannot onboard merchants. */
const TENANT_OPERATOR_PERMISSIONS: StaffPermission[] = STAFF_PERMISSIONS.filter(
  (p) =>
    p !== 'tenant.create' &&
    p !== 'staff.read' &&
    p !== 'settlement.run',
);

const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  /**
   * Platform super-user: full permissions including staff IAM (future staff APIs).
   * Must have casinoGroupId null.
   */
  SUPER_ADMIN: [...STAFF_PERMISSIONS],
  /**
   * Platform operator: cross-tenant ops and merchant onboarding, no staff IAM.
   * Must have casinoGroupId null.
   */
  PLATFORM_ADMIN: [...PLATFORM_OPS_PERMISSIONS],
  /**
   * Tenant operator admin: full control within one casino group.
   * Must have casinoGroupId set.
   */
  OPERATOR_ADMIN: [...TENANT_OPERATOR_PERMISSIONS],
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
  COMPLIANCE: ['tenant.read', 'compliance.audit.read', 'bets.read'],
};

/** Roles that operate cross-tenant (casinoGroupId must be null). */
export const PLATFORM_SCOPE_ROLES: StaffRole[] = [
  StaffRole.SUPER_ADMIN,
  StaffRole.PLATFORM_ADMIN,
];

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

export function hasStaffRole(
  roles: readonly StaffRole[],
  role: StaffRole,
): boolean {
  return roles.includes(role);
}

export function isPlatformScopeRole(roles: readonly StaffRole[]): boolean {
  return roles.some((role) => PLATFORM_SCOPE_ROLES.includes(role));
}
