import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  BetLegOutcome,
  BetStatus,
  MarketType,
  Prisma,
  StaffRole,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { StaffAuthService } from '../src/modules/backoffice/staff/staff-auth.service';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Back office exit criteria (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let acmeGroupId: string;
  let staffUserId: string;
  let voidBetId: string;

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

    const acme = await prisma.casinoGroup.findUniqueOrThrow({
      where: { slug: 'acme' },
    });
    acmeGroupId = acme.id;

    const staff = await prisma.staffUser.upsert({
      where: { email: 'exit-e2e@example.com' },
      create: {
        email: 'exit-e2e@example.com',
        passwordHash: await staffAuth.hashPassword('ExitE2e123!'),
        roles: [StaffRole.PLATFORM_ADMIN],
        casinoGroupId: null,
      },
      update: {
        passwordHash: await staffAuth.hashPassword('ExitE2e123!'),
        roles: [StaffRole.PLATFORM_ADMIN],
        casinoGroupId: null,
      },
    });
    staffUserId = staff.id;
    await prisma.staffCasinoGroupAccess.deleteMany({
      where: { staffUserId: staff.id },
    });
    await prisma.staffCasinoGroupAccess.create({
      data: { staffUserId: staff.id, casinoGroupId: acmeGroupId },
    });

    const selection = await prisma.selection.findFirst({
      where: {
        market: {
          status: 'OPEN',
          event: {
            fixture: {
              league: { groups: { some: { casinoGroupId: acmeGroupId, enabled: true } } },
            },
          },
        },
      },
      include: {
        market: { select: { id: true, eventId: true, type: true } },
      },
    });

    if (!selection) {
      throw new Error('No open selection found for exit-criteria e2e');
    }

    const bet = await prisma.bet.create({
      data: {
        casinoGroupId: acmeGroupId,
        userId: 'exit-e2e-player',
        idempotencyKey: `exit-e2e-${Date.now()}`,
        stake: new Prisma.Decimal('10.00'),
        currency: 'USD',
        status: BetStatus.ACCEPTED,
        combinedOdds: new Prisma.Decimal('1.950'),
        potentialPayout: new Prisma.Decimal('19.50'),
        legs: {
          create: {
            selectionId: selection.id,
            marketId: selection.market.id,
            eventId: selection.market.eventId,
            selectionName: 'Exit E2E Pick',
            priceAtPlacement: new Prisma.Decimal('1.950'),
            legOrder: 0,
            outcome: BetLegOutcome.PENDING,
            marketType: MarketType.MONEYLINE,
            homeTeamName: 'Home',
            awayTeamName: 'Away',
          },
        },
      },
    });
    voidBetId = bet.id;
  });

  afterAll(async () => {
    if (voidBetId) {
      await prisma.betLeg.deleteMany({ where: { betId: voidBetId } }).catch(() => undefined);
      await prisma.bet.deleteMany({ where: { id: voidBetId } }).catch(() => undefined);
    }
    await prisma.staffSession.deleteMany({
      where: { staffUser: { email: 'exit-e2e@example.com' } },
    });
    await prisma.staffCasinoGroupAccess.deleteMany({
      where: { staffUser: { email: 'exit-e2e@example.com' } },
    });
    await prisma.staffUser.deleteMany({
      where: { email: 'exit-e2e@example.com' },
    });
    await app.close();
  });

  it('runs Phase 6 operator exit-criteria flows', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/backoffice/auth/login')
      .send({ email: 'exit-e2e@example.com', password: 'ExitE2e123!' })
      .expect(201);

    const token = login.body.accessToken as string;

    const markets = await request(app.getHttpServer())
      .get(`/api/v1/backoffice/trading/markets?casinoGroupId=${acmeGroupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(markets.body)).toBe(true);
    expect(markets.body.length).toBeGreaterThan(0);

    const market = markets.body[0] as { marketId: string; marketStatus: string };
    const suspendReason = 'risk_spike: Liability spike — exit e2e';

    await request(app.getHttpServer())
      .post(
        `/api/v1/backoffice/trading/markets/${market.marketId}/suspend?casinoGroupId=${acmeGroupId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: suspendReason })
      .expect(201);

    await request(app.getHttpServer())
      .get(
        `/api/v1/backoffice/compliance/audit?casinoGroupId=${acmeGroupId}&action=trading.market_suspended`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const actions = (res.body as { action: string }[]).map((row) => row.action);
        expect(actions).toContain('trading.market_suspended');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/backoffice/trading/markets/${market.marketId}/resume?casinoGroupId=${acmeGroupId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/backoffice/bets/${voidBetId}/void?casinoGroupId=${acmeGroupId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'customer_request: Customer request — exit e2e' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('VOID');
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/backoffice/compliance/audit?casinoGroupId=${acmeGroupId}&action=bets.voided`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const ids = (res.body as { entityId: string }[]).map((row) => row.entityId);
        expect(ids).toContain(voidBetId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/analytics/daily?casinoGroupId=${acmeGroupId}&days=7`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.casinoGroupId).toBe(acmeGroupId);
        expect(Array.isArray(res.body.rows)).toBe(true);
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/backoffice/compliance/audit/export?casinoGroupId=${acmeGroupId}&format=csv`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(String(res.text)).toContain('action');
        expect(String(res.text)).toContain('trading.market_suspended');
      });

    await request(app.getHttpServer())
      .get(`/api/v1/backoffice/bets/exceptions?casinoGroupId=${acmeGroupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.casinoGroupId).toBe(acmeGroupId);
        expect(res.body).toHaveProperty('walletFailures');
      });
  });
});
