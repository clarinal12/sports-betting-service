import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import { resolveStaffCasinoGroupId } from '../staff/staff-scope.util';
import type { StaffContext } from '../staff/staff-context.types';
import { ProductService } from './product.service';
import { UpdateLeaguesDto } from './dto/update-leagues.dto';

@ApiTags('backoffice-product')
@Controller('backoffice/product')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class ProductController {
  constructor(private readonly product: ProductService) {}

  @Get('leagues')
  @RequirePermission('product.leagues.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  listLeagues(
    @CurrentStaff() staff: StaffContext,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.product.listLeagues(groupId);
  }

  @Put('leagues')
  @RequirePermission('product.leagues.update')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  updateLeagues(
    @CurrentStaff() staff: StaffContext,
    @Body() body: UpdateLeaguesDto,
    @Query('casinoGroupId') casinoGroupId?: string,
  ) {
    const groupId = resolveStaffCasinoGroupId(staff, casinoGroupId);
    return this.product.updateLeagues(groupId, body, staff.staffUserId);
  }
}
