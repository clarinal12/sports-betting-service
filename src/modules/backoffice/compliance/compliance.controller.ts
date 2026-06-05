import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StaffAuthGuard } from '../staff/staff-auth.guard';
import { RequirePermission } from '../staff/require-permission.decorator';
import { CurrentStaff } from '../staff/current-staff.decorator';
import type { StaffContext } from '../staff/staff-context.types';
import { StaffScopeService } from '../staff/staff-scope.service';
import { hasStaffRole } from '../staff/staff-permissions';
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
  constructor(
    private readonly compliance: ComplianceService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get('audit')
  @RequirePermission('compliance.audit.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  async audit(
    @CurrentStaff() staff: StaffContext,
    @Query() query: AuditSearchQueryDto,
  ) {
    let groupId: string | null = null;
    if (staff.casinoGroupId) {
      groupId = staff.casinoGroupId;
    } else if (query.casinoGroupId) {
      groupId = await this.scope.resolveCasinoGroupId(
        staff,
        query.casinoGroupId,
      );
    } else if (!hasStaffRole(staff.roles, StaffRole.SUPER_ADMIN)) {
      throw new BadRequestException(
        'Query parameter casinoGroupId is required for platform operators',
      );
    }

    return this.compliance.searchAudit(groupId, {
      casinoGroupId: groupId ?? undefined,
      action: query.action,
      limit: query.limit,
    });
  }
}
