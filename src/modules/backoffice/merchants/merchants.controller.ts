import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';

@ApiTags('backoffice-merchants')
@Controller('backoffice/merchants')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Post()
  @RequirePermission('tenant.create')
  create(
    @CurrentStaff() staff: StaffContext,
    @Body() body: CreateMerchantDto,
  ) {
    return this.merchants.createMerchant(body, staff.staffUserId);
  }
}
