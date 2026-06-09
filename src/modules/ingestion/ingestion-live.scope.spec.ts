import { EventStatus, FixtureStatus } from '@prisma/client';
import { hasLiveGames, resolveLiveSportKeys } from './ingestion-live.scope';

describe('resolveLiveSportKeys', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns distinct league keys for LIVE fixtures', async () => {
    const prisma = {
      fixture: {
        findMany: jest.fn().mockResolvedValue([
          { league: { key: 'basketball_nba' } },
          { league: { key: 'soccer_epl' } },
          { league: { key: 'basketball_nba' } },
        ]),
      },
    };

    const keys = await resolveLiveSportKeys(prisma as never, 15);

    expect(keys).toEqual(['basketball_nba', 'soccer_epl']);
    expect(prisma.fixture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { status: FixtureStatus.LIVE },
            { event: { status: EventStatus.LIVE } },
          ]),
        }),
      }),
    );
  });

  it('does not include scheduled fixtures when prestart is disabled', async () => {
    const prisma = {
      fixture: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    await resolveLiveSportKeys(prisma as never, 0);

    const call = prisma.fixture.findMany.mock.calls[0][0] as {
      where: { OR: unknown[] };
    };
    expect(call.where.OR).toEqual([
      { status: FixtureStatus.LIVE },
      { event: { status: EventStatus.LIVE } },
    ]);
  });

  it('includes scheduled fixtures starting within prestart window', async () => {
    const prisma = {
      fixture: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    await resolveLiveSportKeys(prisma as never, 30);

    const call = prisma.fixture.findMany.mock.calls[0][0] as {
      where: { OR: unknown[] };
    };
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        {
          status: FixtureStatus.SCHEDULED,
          startsAt: {
            gte: now,
            lte: new Date('2026-06-01T12:30:00.000Z'),
          },
        },
      ]),
    );
  });
});

describe('hasLiveGames', () => {
  it('returns true when a LIVE fixture exists', async () => {
    const prisma = {
      fixture: {
        findFirst: jest.fn().mockResolvedValue({ id: 'fx-1' }),
      },
    };

    await expect(hasLiveGames(prisma as never)).resolves.toBe(true);
  });

  it('returns false when no LIVE fixtures exist', async () => {
    const prisma = {
      fixture: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(hasLiveGames(prisma as never)).resolves.toBe(false);
  });
});
