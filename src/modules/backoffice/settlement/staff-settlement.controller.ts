import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';
import { assertPlatformStaff } from '../staff/staff-scope.util';
import { StaffSettlementService } from './staff-settlement.service';
import { ApplyEventResultDto } from './dto/apply-event-result.dto';
import { ApplyProviderResultDto } from './dto/apply-provider-result.dto';

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

  @Post('events/:eventId/run')
  @RequirePermission('settlement.run')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async runEventSettlement(
    @CurrentStaff() staff: StaffContext,
    @Param('eventId') eventId: string,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    assertPlatformStaff(staff);
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.settlement.runSettlementForEvent(
      groupId,
      eventId,
      staff.staffUserId,
    );
  }

  @Post('events/by-provider-ref/result')
  @RequirePermission('settlement.run')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async applyProviderResult(
    @CurrentStaff() staff: StaffContext,
    @Body() body: ApplyProviderResultDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    assertPlatformStaff(staff);
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.settlement.applyManualResultByProviderRef(
      groupId,
      body.providerRef,
      body.homeScore,
      body.awayScore,
      staff.staffUserId,
    );
  }

  @Post('events/:eventId/result')
  @RequirePermission('settlement.run')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async applyEventResult(
    @CurrentStaff() staff: StaffContext,
    @Param('eventId') eventId: string,
    @Body() body: ApplyEventResultDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    assertPlatformStaff(staff);
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.settlement.applyManualResultAndSettle(
      groupId,
      eventId,
      body.homeScore,
      body.awayScore,
      staff.staffUserId,
    );
  }
}
