import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { StaffAuthService } from '../src/modules/backoffice/staff/staff-auth.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import { StaffRole } from '@prisma/client';

describe('Back office (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const staffAuth = app.get(StaffAuthService);
    await app.get(IngestionService).ingestFixtures();

    await prisma.staffUser.upsert({
      where: { email: 'bo-e2e@example.com' },
      create: {
        email: 'bo-e2e@example.com',
        passwordHash: await staffAuth.hashPassword('BoE2e123!'),
        roles: [StaffRole.SUPER_ADMIN],
        casinoGroupId: null,
      },
      update: {
        passwordHash: await staffAuth.hashPassword('BoE2e123!'),
        roles: [StaffRole.SUPER_ADMIN],
        casinoGroupId: null,
      },
    });

    const acme = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'acme' },
    });
    const paE2e = await prisma.staffUser.upsert({
      where: { email: 'pa-e2e@example.com' },
      create: {
        email: 'pa-e2e@example.com',
        passwordHash: await staffAuth.hashPassword('PaE2e123!'),
        roles: [StaffRole.PLATFORM_ADMIN],
        casinoGroupId: null,
      },
      update: {
        passwordHash: await staffAuth.hashPassword('PaE2e123!'),
        roles: [StaffRole.PLATFORM_ADMIN],
        casinoGroupId: null,
      },
    });
    await prisma.staffCasinoGroupAccess.deleteMany({
      where: { staffUserId: paE2e.id },
    });
    await prisma.staffCasinoGroupAccess.create({
      data: { staffUserId: paE2e.id, casinoGroupId: acme.id },
    });

    await prisma.staffUser.upsert({
      where: { email: 'op-e2e@example.com' },
      create: {
        email: 'op-e2e@example.com',
        passwordHash: await staffAuth.hashPassword('OpE2e123!'),
        roles: [StaffRole.OPERATOR_ADMIN],
        casinoGroupId: acme.id,
      },
      update: {
        passwordHash: await staffAuth.hashPassword('OpE2e123!'),
        roles: [StaffRole.OPERATOR_ADMIN],
        casinoGroupId: acme.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.staffSession.deleteMany({
      where: {
        staffUser: {
          email: {
            in: ['bo-e2e@example.com', 'pa-e2e@example.com', 'op-e2e@example.com'],
          },
        },
      },
    });
    await prisma.staffCasinoGroupAccess.deleteMany({
      where: { staffUser: { email: 'pa-e2e@example.com' } },
    });
    await prisma.staffUser.deleteMany({
      where: {
        email: {
          in: ['bo-e2e@example.com', 'pa-e2e@example.com', 'op-e2e@example.com'],
        },
      },
    });
    await prisma.casinoGroup.deleteMany({
      where: {
        slug: {
          in: ['e2e-new-merchant', 'e2e-default-mid', 'e2e-pa-created'],
        },
      },
    });
    await app.close();
  });

  it('logs in staff and returns access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'bo-e2e@example.com', password: 'BoE2e123!' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.staff.permissions).toContain('tenant.create');
  });

  it('creates a merchant and reads tenant product leagues', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'bo-e2e@example.com', password: 'BoE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/api/v1/backoffice/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'e2e-new-merchant',
        name: 'E2E New Merchant',
        merchantId: 'e2e-new-merchant-id',
        defaultCurrency: 'USD',
      })
      .expect(201);

    expect(created.body.sportsSecret).toBeDefined();
    expect(created.body.merchantId).toBe('e2e-new-merchant-id');

    const groupId = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/tenant?casinoGroupId=${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.slug).toBe('e2e-new-merchant');
      });

    const leagues = await request(app.getHttpServer())
      .get(`/api/v1/backoffice/product/leagues?casinoGroupId=${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const nba = (leagues.body as { key: string; enabled: boolean }[]).find(
      (l) => l.key === 'basketball_nba',
    );
    expect(nba?.enabled).toBe(true);
  });

  it('defaults merchantId from slug when omitted', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'bo-e2e@example.com', password: 'BoE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/api/v1/backoffice/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'e2e-default-mid',
        name: 'E2E Default Merchant Id',
      })
      .expect(201);

    expect(created.body.merchantId).toBe('e2e-default-mid-merchant');
  });

  it('returns trading exposure and staff bet list for acme', async () => {
    const acme = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'acme' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'bo-e2e@example.com', password: 'BoE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/trading/exposure?casinoGroupId=${acme.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('openBetCount');
      });

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/bets?casinoGroupId=${acme.id}&limit=5`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('grants platform admin access to a merchant they create', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'pa-e2e@example.com', password: 'PaE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/api/v1/backoffice/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'e2e-pa-created',
        name: 'E2E PA Created Merchant',
      })
      .expect(201);

    const groupId = created.body.id as string;

    await request(app.getHttpServer())
      .get('/api/v1/backoffice/tenants')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const ids = (res.body as { id: string }[]).map((t) => t.id);
        expect(ids).toContain(groupId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/tenant?casinoGroupId=${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.slug).toBe('e2e-pa-created');
      });
  });

  it('lists tenants from database grants for platform admin', async () => {
    const acme = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'acme' },
    });
    const betzone = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'betzone' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'pa-e2e@example.com', password: 'PaE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/v1/backoffice/tenants')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const ids = (res.body as { id: string }[]).map((t) => t.id);
        expect(ids).toContain(acme.id);
        expect(ids).not.toContain(betzone.id);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/tenant?casinoGroupId=${betzone.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('denies tenant operator from running settlement', async () => {
    const acme = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'acme' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'op-e2e@example.com', password: 'OpE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/backoffice/settlement/events/e2e-fake-event/run?casinoGroupId=${acme.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('denies platform admin settlement on unassigned merchant', async () => {
    const betzone = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'betzone' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'pa-e2e@example.com', password: 'PaE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/backoffice/settlement/events/e2e-fake-event/run?casinoGroupId=${betzone.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows super admin to call settlement run on any merchant', async () => {
    const betzone = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'betzone' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'bo-e2e@example.com', password: 'BoE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post(
        `/api/v1/backoffice/settlement/events/e2e-fake-event/run?casinoGroupId=${betzone.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('lets super admin assign platform admin tenant access', async () => {
    const acme = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'acme' },
    });
    const betzone = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'betzone' },
    });
    const paE2e = await prisma.staffUser.findUniqueOrThrow({
      where: { email: 'pa-e2e@example.com' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'bo-e2e@example.com', password: 'BoE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .put(`/api/v1/backoffice/staff/${paE2e.id}/tenant-access`)
      .set('Authorization', `Bearer ${token}`)
      .send({ casinoGroupIds: [acme.id, betzone.id] })
      .expect(200)
      .expect((res) => {
        const slugs = (res.body.casinoGroups as { slug: string }[]).map(
          (g) => g.slug,
        );
        expect(slugs).toEqual(expect.arrayContaining(['acme', 'betzone']));
      });
  });
});
