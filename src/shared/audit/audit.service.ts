import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditRecordInput } from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.auditLogEntry.create({
        data: {
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          casinoGroupId: input.casinoGroupId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          before: input.before ?? undefined,
          after: input.after ?? undefined,
          reason: input.reason ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log (${input.action} ${input.entityType}): ${
          (error as Error).message
        }`,
      );
    }
  }
}
