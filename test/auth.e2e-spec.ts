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

const MERCHANT_ID = 'e2e-auth-merchant';
const SECRET = 'e2e-auth-merchant-secret';

/**
 * Phase 3a e2e: operator launch token -> session token -> authorized request.
 */
describe('Auth / launch (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  function operatorToken(payload: object, opts: jwt.SignOptions = {}): string {
    return jwt.sign(payload, SECRET, { algorithm: 'HS256', ...opts });
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
      where: { slug: 'e2e-auth' },
      create: {
        slug: 'e2e-auth',
        name: 'E2E Auth Casino',
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
  });

  afterAll(async () => {
    await prisma.casinoGroupLeague.deleteMany({
      where: { casinoGroup: { slug: 'e2e-auth' } },
    });
    await prisma.casinoGroup.deleteMany({ where: { slug: 'e2e-auth' } });
    await app.close();
  });

  it('exchanges a valid launch token for a session and authorizes a request', async () => {
    const launch = await request(app.getHttpServer())
      .get('/api/v1/launch')
      .query({
        token: operatorToken({
          userId: 'u1',
          username: 'alice',
          merchantId: MERCHANT_ID,
        }),
      })
      .expect(200);

    const body = launch.body as {
      sessionToken: string;
      user: { currency: string; casinoGroupId: string };
    };
    expect(body.sessionToken).toBeDefined();
    expect(body.user.currency).toBe('USD');

    await request(app.getHttpServer())
      .get('/api/v1/sports')
      .set('Authorization', `Bearer ${body.sessionToken}`)
      .expect(200);
  });

  it('rejects a launch token signed with the wrong secret (401)', () => {
    const bad = jwt.sign(
      { userId: 'u1', username: 'alice', merchantId: MERCHANT_ID },
      'wrong-secret',
      { algorithm: 'HS256' },
    );
    return request(app.getHttpServer())
      .get('/api/v1/launch')
      .query({ token: bad })
      .expect(401);
  });

  it('rejects a launch for an unknown merchant (401)', () => {
    const token = operatorToken({
      userId: 'u1',
      username: 'alice',
      merchantId: 'ghost-merchant',
    });
    return request(app.getHttpServer())
      .get('/api/v1/launch')
      .query({ token })
      .expect(401);
  });

  it('400s when the launch token is missing', () => {
    return request(app.getHttpServer()).get('/api/v1/launch').expect(400);
  });

  it('rejects a bogus session token on a player route (401)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/sports')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});
