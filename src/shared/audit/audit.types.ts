import { Prisma } from '@prisma/client';

export type AuditActorType = 'system' | 'staff';

export interface AuditRecordInput {
  actorType: AuditActorType;
  actorId?: string | null;
  casinoGroupId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
}
