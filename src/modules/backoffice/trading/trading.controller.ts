import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';
import { TradingService } from './trading.service';
import { SuspendReasonDto } from './dto/suspend.dto';
import { PatchRiskLimitsDto } from './dto/patch-limits.dto';

@ApiTags('backoffice-trading')
@Controller('backoffice/trading')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class TradingController {
  constructor(
    private readonly trading: TradingService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get('exposure')
  @RequirePermission('trading.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async exposure(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.trading.getExposure(groupId);
  }

  @Get('limits')
  @RequirePermission('trading.limits.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async limits(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.trading.getLimits(groupId);
  }

  @Patch('limits')
  @RequirePermission('trading.limits.update')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async patchLimits(
    @CurrentStaff() staff: StaffContext,
    @Body() body: PatchRiskLimitsDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.trading.patchLimits(groupId, body, staff.staffUserId);
  }

  @Post('events/:id/suspend')
  @RequirePermission('trading.suspend')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async suspendEvent(
    @CurrentStaff() staff: StaffContext,
    @Param('id') eventId: string,
    @Body() body: SuspendReasonDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.trading.suspendEvent(groupId, eventId, body.reason, staff.staffUserId);
  }

  @Post('markets/:id/suspend')
  @RequirePermission('trading.suspend')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async suspendMarket(
    @CurrentStaff() staff: StaffContext,
    @Param('id') marketId: string,
    @Body() body: SuspendReasonDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.trading.suspendMarket(groupId, marketId, body.reason, staff.staffUserId);
  }

  @Post('markets/:id/resume')
  @RequirePermission('trading.suspend')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async resumeMarket(
    @CurrentStaff() staff: StaffContext,
    @Param('id') marketId: string,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.trading.resumeMarket(groupId, marketId, staff.staffUserId);
  }
}
