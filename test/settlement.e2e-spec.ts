import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { SettlementService } from '../src/modules/settlement/settlement.service';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Settlement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let settlement: SettlementService;

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
    settlement = app.get(SettlementService);
    await app.get(IngestionService).ingestFixtures();
  });

  afterAll(async () => {
    await prisma.bet.deleteMany({
      where: { userId: 'e2e-settlement-user' },
    });
    await app.close();
  });

  it('settles an accepted bet when the event has ended', async () => {
    const group = await prisma.casinoGroup.upsert({
      where: { slug: 'e2e-settlement' },
      create: {
        slug: 'e2e-settlement',
        name: 'E2E Settlement',
        defaultCurrency: 'USD',
      },
      update: {},
    });

    const selection = await prisma.selection.findFirst({
      where: {
        name: 'Golden State Warriors',
        market: {
          type: 'MATCH_RESULT',
          event: { providerRef: 'evt_mock_nba_5' },
        },
      },
      include: { market: true },
    });
    if (!selection) {
      throw new Error('Ended mock NBA selection not found');
    }

    const bet = await prisma.bet.create({
      data: {
        casinoGroupId: group.id,
        userId: 'e2e-settlement-user',
        idempotencyKey: `settle-e2e-${Date.now()}`,
        stake: '10.00',
        currency: 'USD',
        status: 'ACCEPTED',
        combinedOdds: '2.450',
        potentialPayout: '24.50',
        walletReservationId: 'stub-e2e',
        legs: {
          create: {
            selectionId: selection.id,
            marketId: selection.marketId,
            eventId: selection.market.eventId,
            selectionName: selection.name,
            priceAtPlacement: selection.price,
            legOrder: 0,
          },
        },
      },
    });

    const settled = await settlement.trySettleBet(bet.id);
    expect(settled).toBe(true);

    const updated = await prisma.bet.findUniqueOrThrow({
      where: { id: bet.id },
      include: { legs: true },
    });
    expect(updated.status).toBe('WON');
    expect(updated.payoutAmount?.toFixed(2)).toBe('24.50');
    expect(updated.settledAt).not.toBeNull();
    expect(updated.legs[0].outcome).toBe('WON');
  });
});
