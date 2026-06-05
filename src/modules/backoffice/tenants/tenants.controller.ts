import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';

@ApiTags('backoffice-tenants')
@Controller('backoffice/tenants')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly scope: StaffScopeService) {}

  @Get()
  @RequirePermission('tenant.read')
  list(@CurrentStaff() staff: StaffContext) {
    return this.scope.listAccessibleTenants(staff);
  }
}
