import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from './staff-auth.guard';
import { RequirePermission } from './require-permission.decorator';
import { CurrentStaff } from './current-staff.decorator';
import { assertSuperAdmin } from './staff-scope.util';
import type { StaffContext } from './staff-context.types';
import { StaffAdminService } from './staff-admin.service';
import { UpdateStaffTenantAccessDto } from './dto/update-staff-tenant-access.dto';
import { ListOperatorsQueryDto } from './dto/list-operators-query.dto';
import { CreateOperatorStaffDto } from './dto/create-operator-staff.dto';
import { UpdateOperatorStaffDto } from './dto/update-operator-staff.dto';

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

  @Get('operators')
  @RequirePermission('staff.operator.read')
  listOperators(
    @CurrentStaff() staff: StaffContext,
    @Query() query: ListOperatorsQueryDto,
  ) {
    return this.staffAdmin.listOperatorAdmins(staff, query.casinoGroupId);
  }

  @Post('operators')
  @RequirePermission('staff.operator.update')
  createOperator(
    @CurrentStaff() staff: StaffContext,
    @Query() query: ListOperatorsQueryDto,
    @Body() body: CreateOperatorStaffDto,
  ) {
    return this.staffAdmin.createOperatorAdmin(
      staff,
      query.casinoGroupId,
      body,
    );
  }

  @Patch('operators/:staffUserId')
  @RequirePermission('staff.operator.update')
  updateOperator(
    @CurrentStaff() staff: StaffContext,
    @Param('staffUserId') staffUserId: string,
    @Query() query: ListOperatorsQueryDto,
    @Body() body: UpdateOperatorStaffDto,
  ) {
    return this.staffAdmin.updateOperatorAdmin(
      staff,
      staffUserId,
      query.casinoGroupId,
      body,
    );
  }
}
