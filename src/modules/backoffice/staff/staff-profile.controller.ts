import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from './staff-auth.guard';
import { CurrentStaff } from './current-staff.decorator';
import type { StaffContext } from './staff-context.types';

@ApiTags('backoffice-staff')
@Controller('backoffice/staff')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class StaffProfileController {
  @Get('me')
  me(@CurrentStaff() staff: StaffContext) {
    return {
      id: staff.staffUserId,
      email: staff.email,
      casinoGroupId: staff.casinoGroupId,
      roles: staff.roles,
      permissions: staff.permissions,
    };
  }
}
