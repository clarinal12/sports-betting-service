import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';
import { ProductService } from './product.service';
import { UpdateLeaguesDto } from './dto/update-leagues.dto';

@ApiTags('backoffice-product')
@Controller('backoffice/product')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class ProductController {
  constructor(
    private readonly product: ProductService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get('leagues')
  @RequirePermission('product.leagues.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async listLeagues(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.product.listLeagues(groupId);
  }

  @Put('leagues')
  @RequirePermission('product.leagues.update')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async updateLeagues(
    @CurrentStaff() staff: StaffContext,
    @Body() body: UpdateLeaguesDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = await this.scope.resolveCasinoGroupId(staff, casinoGroupId);
    return this.product.updateLeagues(groupId, body, staff.staffUserId);
  }
}
