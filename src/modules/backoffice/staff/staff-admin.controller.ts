import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from './staff-auth.guard';
import { RequirePermission } from './require-permission.decorator';
import { CurrentStaff } from './current-staff.decorator';
import { assertSuperAdmin } from './staff-scope.util';
import type { StaffContext } from './staff-context.types';
import { StaffAdminService } from './staff-admin.service';
import { UpdateStaffTenantAccessDto } from './dto/update-staff-tenant-access.dto';

@ApiTags('backoffice-staff-admin')
@Controller('backoffice/staff')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class StaffAdminController {
  constructor(private readonly staffAdmin: StaffAdminService) {}

  @Get('platform-admins')
  @RequirePermission('staff.tenant_access.read')
  listPlatformAdmins(@CurrentStaff() staff: StaffContext) {
    assertSuperAdmin(staff);
    return this.staffAdmin.listPlatformAdmins();
  }

  @Put(':staffUserId/tenant-access')
  @RequirePermission('staff.tenant_access.update')
  setTenantAccess(
    @CurrentStaff() staff: StaffContext,
    @Param('staffUserId') staffUserId: string,
    @Body() body: UpdateStaffTenantAccessDto,
  ) {
    assertSuperAdmin(staff);
    return this.staffAdmin.setPlatformAdminTenantAccess(
      staffUserId,
      body.casinoGroupIds,
      staff.staffUserId,
    );
  }
}
