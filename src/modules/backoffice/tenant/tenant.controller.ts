import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import { resolveStaffCasinoGroupId } from '../staff/staff-scope.util';
import type { StaffContext } from '../staff/staff-context.types';
import { TenantService } from './tenant.service';
import { PatchTenantDto } from './dto/patch-tenant.dto';

@ApiTags('backoffice-tenant')
@Controller('backoffice/tenant')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get()
  @RequirePermission('tenant.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  get(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.tenant.getTenant(groupId);
  }

  @Patch()
  @RequirePermission('tenant.update')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  patch(
    @CurrentStaff() staff: StaffContext,
    @Body() body: PatchTenantDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.tenant.patchTenant(groupId, body, staff.staffUserId);
  }
}
