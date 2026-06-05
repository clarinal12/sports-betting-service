import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import { resolveStaffCasinoGroupId } from '../staff/staff-scope.util';
import type { StaffContext } from '../staff/staff-context.types';
import { ComplianceService } from './compliance.service';

class AuditSearchQueryDto {
  @IsOptional()
  @IsString()
  casinoGroupId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

@ApiTags('backoffice-compliance')
@Controller('backoffice/compliance')
@UseGuards(StaffAuthGuard)
@ApiBearerAuth()
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('audit')
  @RequirePermission('compliance.audit.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  audit(@CurrentStaff() staff: StaffContext, @Query() query: AuditSearchQueryDto) {
    const groupId = staff.casinoGroupId
      ? staff.casinoGroupId
      : query.casinoGroupId
        ? resolveStaffCasinoGroupId(staff, query.casinoGroupId)
        : null;
    return this.compliance.searchAudit(groupId, {
      casinoGroupId: groupId ?? undefined,
      action: query.action,
      limit: query.limit,
    });
  }
}
