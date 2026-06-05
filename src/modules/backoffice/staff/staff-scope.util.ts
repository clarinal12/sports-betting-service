import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { StaffContext } from './staff-context.types';

/** Resolves which casino group a staff request targets. */
export function resolveStaffCasinoGroupId(
  staff: StaffContext,
  requestedGroupId?: string,
): string {
  if (staff.casinoGroupId) {
    if (requestedGroupId && requestedGroupId !== staff.casinoGroupId) {
      throw new ForbiddenException('Cannot access another casino group');
    }
    return staff.casinoGroupId;
  }
  if (!requestedGroupId) {
    throw new BadRequestException(
      'Query parameter casinoGroupId is required for platform operators',
    );
  }
  return requestedGroupId;
}
