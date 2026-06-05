import { execSync } from 'child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../../src/shared/audit/audit.service';

const runIntegration = process.env.INTEGRATION_TEST === '1';

(runIntegration ? describe : describe.skip)(
  'AuditService (Testcontainers Postgres)',
  () => {
    let prisma: PrismaClient;
    let container: PostgreSqlContainer;

    beforeAll(async () => {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      const databaseUrl = container.getConnectionUri();
      process.env.DATABASE_URL = databaseUrl;
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
      prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    }, 180_000);

    afterAll(async () => {
      await prisma?.$disconnect();
      await container?.stop();
    });

    it('persists an audit log row', async () => {
      const audit = new AuditService(prisma as never);
      await audit.record({
        actorType: 'system',
        actorId: 'integration-test',
        action: 'test.audit_write',
        entityType: 'Test',
        entityId: 'e1',
        after: { ok: true },
      });

      const row = await prisma.auditLogEntry.findFirst({
        where: { action: 'test.audit_write' },
      });
      expect(row).not.toBeNull();
      expect(row?.actorType).toBe('system');
      expect(row?.after).toEqual({ ok: true });
    });
  },
);
