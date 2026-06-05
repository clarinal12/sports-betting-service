import { SetMetadata } from '@nestjs/common';
import { StaffPermission } from './staff-permissions';

export const STAFF_PERMISSION_KEY = 'staffPermission';

export const RequirePermission = (permission: StaffPermission) =>
  SetMetadata(STAFF_PERMISSION_KEY, permission);
