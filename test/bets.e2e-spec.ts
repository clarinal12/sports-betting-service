import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { CryptoService } from '../src/shared/crypto/crypto.service';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { PrismaService } from '../src/shared/database/prisma.service';

const MERCHANT_ID = 'e2e-bets-merchant';
const SECRET = 'e2e-bets-merchant-secret';

describe('Bets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionToken: string;
  let selectionId: string;

  function operatorToken(payload: object): string {
    return jwt.sign(payload, SECRET, { algorithm: 'HS256' });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
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
    const crypto = app.get(CryptoService);
    await app.get(IngestionService).ingestFixtures();

    const group = await prisma.casinoGroup.upsert({
      where: { slug: 'e2e-bets' },
      create: {
        slug: 'e2e-bets',
        name: 'E2E Bets Casino',
        defaultCurrency: 'USD',
        merchantId: MERCHANT_ID,
        sportsSecret: crypto.encrypt(SECRET),
      },
      update: {
        merchantId: MERCHANT_ID,
        sportsSecret: crypto.encrypt(SECRET),
      },
    });

    const leagues = await prisma.league.findMany({ select: { id: true } });
    for (const league of leagues) {
      await prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: group.id,
            leagueId: league.id,
          },
        },
        create: { casinoGroupId: group.id, leagueId: league.id, enabled: true },
        update: { enabled: true },
      });
    }

    const selection = await prisma.selection.findFirst({
      where: {
        status: 'OPEN',
        market: {
          status: 'OPEN',
          event: {
            fixture: {
              league: { groups: { some: { casinoGroupId: group.id } } },
            },
          },
        },
      },
    });
    if (!selection) {
      throw new Error('No open selection found for e2e bets test');
    }
    selectionId = selection.id;

    const launchRes = await request(app.getHttpServer())
      .get('/api/v1/launch')
      .query({
        token: operatorToken({
          userId: 'e2e-bettor',
          username: 'bettor',
          merchantId: MERCHANT_ID,
        }),
      })
      .expect(200);
    sessionToken = launchRes.body.sessionToken as string;
  });

  afterAll(async () => {
    const group = await prisma.casinoGroup.findUnique({
      where: { slug: 'e2e-bets' },
      select: { id: true },
    });
    if (group) {
      const bets = await prisma.bet.findMany({
        where: { casinoGroupId: group.id },
        select: { id: true },
      });
      if (bets.length > 0) {
        await prisma.walletOutbox.deleteMany({
          where: { betId: { in: bets.map((b) => b.id) } },
        });
      }
      await prisma.bet.deleteMany({ where: { casinoGroupId: group.id } });
    }
    await prisma.casinoGroupLeague.deleteMany({
      where: { casinoGroup: { slug: 'e2e-bets' } },
    });
    await prisma.casinoGroup.deleteMany({ where: { slug: 'e2e-bets' } });
    await app.close();
  });

  it('rejects bet placement without session token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bets')
      .set('Idempotency-Key', 'no-auth-key')
      .send({ selectionIds: [selectionId], stake: '5.00' })
      .expect(401);
  });

  it('returns wallet balance for the authenticated player', async () => {
    const balanceRes = await request(app.getHttpServer())
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(balanceRes.body).toMatchObject({
      balance: expect.any(String),
      currency: 'USD',
    });
  });

  it('places a bet and returns the same result for idempotent retry', async () => {
    const key = `e2e-bet-${Date.now()}`;

    const first = await request(app.getHttpServer())
      .post('/api/v1/bets')
      .set('Authorization', `Bearer ${sessionToken}`)
      .set('Idempotency-Key', key)
      .send({ selectionIds: [selectionId], stake: '5.00' })
      .expect(201);

    expect(first.body.status).toBe('ACCEPTED');
    expect(first.body.stake).toBe('5');
    expect(first.body.legs).toHaveLength(1);
    expect(first.body.legs[0].marketType).toBeTruthy();
    expect(first.body.legs[0].homeTeamName).toBeTruthy();
    expect(first.body.legs[0].awayTeamName).toBeTruthy();
    expect(first.body.legs[0].eventProviderRef).toBeTruthy();

    const second = await request(app.getHttpServer())
      .post('/api/v1/bets')
      .set('Authorization', `Bearer ${sessionToken}`)
      .set('Idempotency-Key', key)
      .send({ selectionIds: [selectionId], stake: '5.00' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const list = await request(app.getHttpServer())
      .get('/api/v1/bets')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect((list.body as { id: string }[]).some((b) => b.id === first.body.id)).toBe(
      true,
    );
  });
});
