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
import { resolveStaffCasinoGroupId } from '../staff/staff-scope.util';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffBetsService } from './staff-bets.service';
import { SearchBetsQueryDto } from './dto/search-bets.dto';
import { VoidBetDto } from './dto/void-bet.dto';

@ApiTags('backoffice-bets')
@Controller('backoffice/bets')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class StaffBetsController {
  constructor(private readonly bets: StaffBetsService) {}

  @Get()
  @RequirePermission('bets.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  search(@CurrentStaff() staff: StaffContext, @Query() query: SearchBetsQueryDto) {
    const groupId = resolveStaffCasinoGroupId(staff, query.casinoGroupId);
    return this.bets.search(groupId, query);
  }

  @Get(':id')
  @RequirePermission('bets.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  get(
    @CurrentStaff() staff: StaffContext,
    @Param('id') betId: string,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.bets.getById(groupId, betId);
  }

  @Post(':id/void')
  @RequirePermission('bets.void')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  voidBet(
    @CurrentStaff() staff: StaffContext,
    @Param('id') betId: string,
    @Body() body: VoidBetDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.bets.voidBet(groupId, betId, body.reason, staff.staffUserId);
  }
}
