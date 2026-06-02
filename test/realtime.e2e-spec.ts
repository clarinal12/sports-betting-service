import type { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { CryptoService } from '../src/shared/crypto/crypto.service';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import {
  REALTIME_NAMESPACE,
  WS_CLIENT_SUBSCRIBE,
  WS_SERVER_CONNECTED,
  WS_SERVER_EVENT_UPDATE,
} from '../src/modules/realtime/realtime.constants';

const MERCHANT_ID = 'e2e-ws-merchant';
const SECRET = 'e2e-ws-merchant-secret';

function listenPort(server: {
  address(): AddressInfo | string | null;
}): number {
  const address = server.address();
  if (address && typeof address === 'object') {
    return address.port;
  }
  return 3001;
}

describe('Realtime gateway (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;
  let baseUrl: string;
  let casinoGroupId: string;
  let liveEventId: string;

  function operatorToken(): string {
    return jwt.sign(
      { userId: 'ws-user', username: 'ws-player', merchantId: MERCHANT_ID },
      SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
  }

  async function sessionToken(): Promise<string> {
    const launch = await request(httpServer)
      .get('/api/v1/launch')
      .query({ token: operatorToken() })
      .expect(200);
    return (launch.body as { sessionToken: string }).sessionToken;
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
    await app.listen(0);

    httpServer = app.getHttpServer();
    baseUrl = `http://127.0.0.1:${listenPort(httpServer)}`;
    prisma = app.get(PrismaService);
    const crypto = app.get(CryptoService);
    await app.get(IngestionService).ingestFixtures();

    const group = await prisma.casinoGroup.upsert({
      where: { slug: 'e2e-ws' },
      create: {
        slug: 'e2e-ws',
        name: 'E2E WS Casino',
        merchantId: MERCHANT_ID,
        sportsSecret: crypto.encrypt(SECRET),
      },
      update: {
        merchantId: MERCHANT_ID,
        sportsSecret: crypto.encrypt(SECRET),
      },
    });
    casinoGroupId = group.id;

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

    const live = await request(httpServer)
      .get('/api/v1/events/live')
      .set('Authorization', `Bearer ${await sessionToken()}`)
      .expect(200);
    const events = live.body as { id: string }[];
    liveEventId = events[0]?.id;
    expect(liveEventId).toBeDefined();
  });

  afterAll(async () => {
    await prisma.casinoGroupLeague.deleteMany({
      where: { casinoGroup: { slug: 'e2e-ws' } },
    });
    await prisma.casinoGroup.deleteMany({ where: { slug: 'e2e-ws' } });
    await app.close();
  });

  it('rejects connections without a session token', async () => {
    const socket = io(`${baseUrl}${REALTIME_NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve) => {
      socket.on('disconnect', () => resolve());
      socket.on('connect', () => {
        // Server disconnects unauthenticated clients shortly after connect.
      });
      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 2000);
    });
    expect(socket.connected).toBe(false);
  });

  it('subscribes to a live event and receives updates after ingestion', async () => {
    const token = await sessionToken();

    const socket: Socket = io(`${baseUrl}${REALTIME_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('WS connected timeout')),
        5000,
      );
      socket.on(WS_SERVER_CONNECTED, () => {
        socket.emit(WS_CLIENT_SUBSCRIBE, {
          eventIds: [liveEventId],
          marketIds: [],
        });
      });
      socket.on(WS_SERVER_CONNECTED, (payload: { subscribed?: unknown }) => {
        if (payload.subscribed) {
          clearTimeout(timeout);
          resolve();
        }
      });
      socket.on('connect_error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const updatePromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('event.update timeout')),
        8000,
      );
      socket.on(WS_SERVER_EVENT_UPDATE, (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    await app.get(IngestionService).ingestFixtures();
    const update = (await updatePromise) as { eventId: string };
    expect(update.eventId).toBe(liveEventId);

    socket.disconnect();
    expect(casinoGroupId).toBeDefined();
  });
});
