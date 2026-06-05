import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';

export interface AuditSearchQuery {
  casinoGroupId?: string;
  action?: string;
  limit?: number;
}

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAudit(casinoGroupId: string | null, query: AuditSearchQuery) {
    const limit = Math.min(query.limit ?? 50, 200);
    const where: Prisma.AuditLogEntryWhereInput = {
      ...(query.casinoGroupId ? { casinoGroupId: query.casinoGroupId } : {}),
      ...(casinoGroupId ? { casinoGroupId } : {}),
      ...(query.action ? { action: { contains: query.action } } : {}),
    };

    const rows = await this.prisma.auditLogEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actorId: row.actorId,
      casinoGroupId: row.casinoGroupId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
