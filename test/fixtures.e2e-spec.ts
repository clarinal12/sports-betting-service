import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { PrismaService } from '../src/shared/database/prisma.service';

/**
 * Tenant-scoping e2e: seeds catalog + two groups with different enabled
 * leagues, then asserts each group only sees its own offering.
 */
describe('Player API tenant scoping (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
    await app.get(IngestionService).ingestFixtures();

    const acme = await prisma.casinoGroup.upsert({
      where: { slug: 'e2e-acme' },
      create: { slug: 'e2e-acme', name: 'E2E Acme' },
      update: {},
    });
    const betzone = await prisma.casinoGroup.upsert({
      where: { slug: 'e2e-betzone' },
      create: { slug: 'e2e-betzone', name: 'E2E BetZone' },
      update: {},
    });

    const leagues = await prisma.league.findMany({
      select: { id: true, key: true },
    });
    for (const league of leagues) {
      await prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: acme.id,
            leagueId: league.id,
          },
        },
        create: { casinoGroupId: acme.id, leagueId: league.id, enabled: true },
        update: { enabled: true },
      });
      // BetZone enables only soccer leagues.
      await prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: betzone.id,
            leagueId: league.id,
          },
        },
        create: {
          casinoGroupId: betzone.id,
          leagueId: league.id,
          enabled: league.key.startsWith('soccer_'),
        },
        update: { enabled: league.key.startsWith('soccer_') },
      });
    }
  });

  afterAll(async () => {
    await prisma.casinoGroupLeague.deleteMany({
      where: { casinoGroup: { slug: { in: ['e2e-acme', 'e2e-betzone'] } } },
    });
    await prisma.casinoGroup.deleteMany({
      where: { slug: { in: ['e2e-acme', 'e2e-betzone'] } },
    });
    await app.close();
  });

  it('returns 400 without the casino group header', () => {
    return request(app.getHttpServer()).get('/api/v1/sports').expect(400);
  });

  it('returns 403 for an unknown casino group', () => {
    return request(app.getHttpServer())
      .get('/api/v1/sports')
      .set('X-Casino-Group', 'does-not-exist')
      .expect(403);
  });

  it('scopes sports to the group offering', async () => {
    const acme = await request(app.getHttpServer())
      .get('/api/v1/sports')
      .set('X-Casino-Group', 'e2e-acme')
      .expect(200);
    const betzone = await request(app.getHttpServer())
      .get('/api/v1/sports')
      .set('X-Casino-Group', 'e2e-betzone')
      .expect(200);

    const acmeKeys = (acme.body as { key: string }[]).map((s) => s.key).sort();
    const betzoneKeys = (betzone.body as { key: string }[]).map((s) => s.key);

    expect(acmeKeys).toEqual(['basketball', 'soccer']);
    expect(betzoneKeys).toEqual(['soccer']);
  });

  it('excludes fixtures from disabled leagues', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/fixtures?pageSize=100')
      .set('X-Casino-Group', 'e2e-betzone')
      .expect(200);

    const body = res.body as { data: unknown[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    // BetZone has no basketball; soccer-only fixtures from mock data total 5.
    expect(body.total).toBe(5);
  });
});
