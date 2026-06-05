import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';
import { StaffSettlementService } from './staff-settlement.service';

@ApiTags('backoffice-settlement')
@Controller('backoffice/settlement')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class StaffSettlementController {
  constructor(
    private readonly settlement: StaffSettlementService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get('events')
  @RequirePermission('settlement.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async events(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.settlement.listUnsettledEvents(groupId);
  }
}
