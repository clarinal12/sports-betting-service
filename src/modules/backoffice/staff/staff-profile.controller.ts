import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../../shared/audit/audit.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { CurrentStaff } from './current-staff.decorator';
import type { StaffContext } from './staff-context.types';
import { StaffAuthService } from './staff-auth.service';
import { ChangeStaffPasswordDto } from './dto/change-staff-password.dto';

@ApiTags('backoffice-staff')
@Controller('backoffice/staff')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class StaffProfileController {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AuditService,
  ) {}

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

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentStaff() staff: StaffContext,
    @Body() body: ChangeStaffPasswordDto,
  ): Promise<void> {
    await this.staffAuth.changePassword(
      staff.staffUserId,
      body.currentPassword,
      body.newPassword,
    );

    await this.audit.record({
      actorType: 'staff',
      actorId: staff.staffUserId,
      casinoGroupId: staff.casinoGroupId,
      action: 'staff.password_changed',
      entityType: 'StaffUser',
      entityId: staff.staffUserId,
      reason: 'Self-service password change',
    });
  }
}
