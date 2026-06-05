import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import { resolveStaffCasinoGroupId } from '../staff/staff-scope.util';
import type { StaffContext } from '../staff/staff-context.types';
import { AnalyticsService } from './analytics.service';

@ApiTags('backoffice-analytics')
@Controller('backoffice/analytics')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @RequirePermission('analytics.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  summary(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.analytics.summary(groupId);
  }
}
