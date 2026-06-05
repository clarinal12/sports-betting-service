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
        roles: [StaffRole.OPERATOR_ADMIN],
        casinoGroupId: null,
      },
      update: {
        passwordHash: await staffAuth.hashPassword('BoE2e123!'),
        roles: [StaffRole.OPERATOR_ADMIN],
      },
    });
  });

  afterAll(async () => {
    await prisma.staffSession.deleteMany({
      where: { staffUser: { email: 'bo-e2e@example.com' } },
    });
    await prisma.staffUser.deleteMany({ where: { email: 'bo-e2e@example.com' } });
    await prisma.casinoGroup.deleteMany({ where: { slug: 'e2e-new-merchant' } });
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
});
