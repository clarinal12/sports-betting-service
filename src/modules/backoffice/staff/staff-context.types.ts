import { StaffRole } from '@prisma/client';
import { StaffPermission } from './staff-permissions';

export interface StaffContext {
  staffUserId: string;
  email: string;
  casinoGroupId: string | null;
  roles: StaffRole[];
  permissions: StaffPermission[];
}

export interface StaffTokenClaims {
  sub: string;
  email: string;
  casinoGroupId: string | null;
  roles: StaffRole[];
  permissions: StaffPermission[];
  typ: 'staff';
}

declare module 'express' {
  interface Request {
    staff?: StaffContext;
  }
}
