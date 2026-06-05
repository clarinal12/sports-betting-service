import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';
import { AnalyticsService } from './analytics.service';

@ApiTags('backoffice-analytics')
@Controller('backoffice/analytics')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get('summary')
  @RequirePermission('analytics.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async summary(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.analytics.summary(groupId);
  }

  @Get('daily')
  @RequirePermission('analytics.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async daily(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
    @Query('days') days?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    const parsedDays = days ? Number.parseInt(days, 10) : 7;
    return this.analytics.dailyGgrBySport(
      groupId,
      Number.isFinite(parsedDays) ? parsedDays : 7,
    );
  }
}
