import { EventStatus, FixtureStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

const LIVE_GAME_SCOPE: Prisma.FixtureWhereInput = {
  OR: [
    { status: FixtureStatus.LIVE },
    { event: { status: EventStatus.LIVE } },
  ],
};

/** True when at least one fixture or event is currently LIVE. */
export async function hasLiveGames(prisma: PrismaService): Promise<boolean> {
  const fixture = await prisma.fixture.findFirst({
    where: LIVE_GAME_SCOPE,
    select: { id: true },
  });
  return fixture !== null;
}

/**
 * Distinct Odds API league/sport keys to poll on a live ingest tick.
 * Always includes LIVE fixtures/events. When `prestartMinutes` > 0, also
 * includes SCHEDULED fixtures starting within that window.
 */
export async function resolveLiveSportKeys(
  prisma: PrismaService,
  prestartMinutes: number,
): Promise<string[]> {
  const scope: Prisma.FixtureWhereInput[] = [...(LIVE_GAME_SCOPE.OR ?? [])];

  if (prestartMinutes > 0) {
    const now = new Date();
    const prestartUntil = new Date(now.getTime() + prestartMinutes * 60_000);
    scope.push({
      status: FixtureStatus.SCHEDULED,
      startsAt: { gte: now, lte: prestartUntil },
    });
  }

  const fixtures = await prisma.fixture.findMany({
    where: { OR: scope },
    select: { league: { select: { key: true } } },
  });

  return [...new Set(fixtures.map((row) => row.league.key))].sort();
}
