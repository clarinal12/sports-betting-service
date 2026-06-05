import {
  BadRequestException,
  Controller,
  Get,
  Header,
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
import { auditRowsToCsv } from './audit-export.util';

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
  @Max(5000)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  format?: 'json' | 'csv';
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

  @Get('audit/export')
  @RequirePermission('compliance.audit.read')
  @ApiQuery({ name: 'casinoGroupId', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async exportAudit(
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

    const rows = await this.compliance.exportAudit(groupId, {
      casinoGroupId: groupId ?? undefined,
      action: query.action,
      limit: query.limit ?? 2000,
    });

    if (query.format === 'csv') {
      return auditRowsToCsv(
        rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          actorType: row.actorType,
          actorId: row.actorId,
          casinoGroupId: row.casinoGroupId,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          reason: row.reason,
        })),
      );
    }
    return { count: rows.length, entries: rows };
  }
}
