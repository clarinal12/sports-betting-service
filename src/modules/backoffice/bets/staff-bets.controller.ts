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
import { StaffBetsService } from './staff-bets.service';
import { SearchBetsQueryDto } from './dto/search-bets.dto';
import { VoidBetDto } from './dto/void-bet.dto';

@ApiTags('backoffice-bets')
@Controller('backoffice/bets')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class StaffBetsController {
  constructor(
    private readonly bets: StaffBetsService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get()
  @RequirePermission('bets.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async search(
    @CurrentStaff() staff: StaffContext,
    @Query() query: SearchBetsQueryDto,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(
      staff,
      query.casinoGroupId,
    );
    return this.bets.search(groupId, query);
  }

  @Get(':id')
  @RequirePermission('bets.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async get(
    @CurrentStaff() staff: StaffContext,
    @Param('id') betId: string,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.bets.getById(groupId, betId);
  }

  @Post(':id/void')
  @RequirePermission('bets.void')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async voidBet(
    @CurrentStaff() staff: StaffContext,
    @Param('id') betId: string,
    @Body() body: VoidBetDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.bets.voidBet(groupId, betId, body.reason, staff.staffUserId);
  }
}
