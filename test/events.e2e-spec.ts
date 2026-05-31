import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { PrismaService } from '../src/shared/database/prisma.service';

/**
 * Phase 2 e2e: live events + markets/odds, with tenant scoping.
 * acme enables all leagues; betzone enables only soccer.
 */
describe('Events & markets (e2e)', () => {
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
      where: { slug: 'e2e-evt-acme' },
      create: { slug: 'e2e-evt-acme', name: 'E2E Evt Acme' },
      update: {},
    });
    const betzone = await prisma.casinoGroup.upsert({
      where: { slug: 'e2e-evt-betzone' },
      create: { slug: 'e2e-evt-betzone', name: 'E2E Evt BetZone' },
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
      where: {
        casinoGroup: { slug: { in: ['e2e-evt-acme', 'e2e-evt-betzone'] } },
      },
    });
    await prisma.casinoGroup.deleteMany({
      where: { slug: { in: ['e2e-evt-acme', 'e2e-evt-betzone'] } },
    });
    await app.close();
  });

  it('lists live events scoped to the group offering', async () => {
    const acme = await request(app.getHttpServer())
      .get('/api/v1/events/live')
      .set('X-Casino-Group', 'e2e-evt-acme')
      .expect(200);
    const betzone = await request(app.getHttpServer())
      .get('/api/v1/events/live')
      .set('X-Casino-Group', 'e2e-evt-betzone')
      .expect(200);

    const acmeEvents = acme.body as { status: string }[];
    const betzoneEvents = betzone.body as { status: string }[];

    expect(acmeEvents.length).toBeGreaterThan(betzoneEvents.length);
    expect(acmeEvents.every((e) => e.status === 'LIVE')).toBe(true);
    // betzone has exactly one live soccer event in the mock data.
    expect(betzoneEvents).toHaveLength(1);
  });

  it('returns markets with decimal odds as strings', async () => {
    const events = await request(app.getHttpServer())
      .get('/api/v1/events/live')
      .set('X-Casino-Group', 'e2e-evt-acme')
      .expect(200);
    const eventId = (events.body as { id: string }[])[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/markets`)
      .set('X-Casino-Group', 'e2e-evt-acme')
      .expect(200);

    const markets = res.body as {
      type: string;
      selections: { price: string }[];
    }[];
    expect(markets.length).toBeGreaterThan(0);
    const price = markets[0].selections[0].price;
    expect(typeof price).toBe('string');
    expect(Number.isNaN(Number(price))).toBe(false);
  });

  it('blocks cross-tenant access to a disabled-league event (404)', async () => {
    // Find a basketball (NBA) event via acme, then request it as betzone.
    const events = await request(app.getHttpServer())
      .get('/api/v1/events/live')
      .set('X-Casino-Group', 'e2e-evt-acme')
      .expect(200);

    const nbaShortNames = ['MIA', 'LAL', 'GSW', 'BOS'];
    const nbaEvent = (
      events.body as { id: string; homeTeam: { shortName: string } }[]
    ).find((e) => nbaShortNames.includes(e.homeTeam.shortName));
    expect(nbaEvent).toBeDefined();

    await request(app.getHttpServer())
      .get(`/api/v1/events/${nbaEvent!.id}`)
      .set('X-Casino-Group', 'e2e-evt-betzone')
      .expect(404);
  });
});
