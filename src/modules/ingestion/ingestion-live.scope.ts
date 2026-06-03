import { EventStatus, FixtureStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

/**
 * Distinct Odds API league/sport keys to poll on a live ingest tick.
 * Includes fixtures that are LIVE or scheduled to start within `prestartMinutes`.
 */
export async function resolveLiveSportKeys(
  prisma: PrismaService,
  prestartMinutes: number,
): Promise<string[]> {
  const now = new Date();
  const prestartUntil = new Date(now.getTime() + prestartMinutes * 60_000);

  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [
        { status: FixtureStatus.LIVE },
        { event: { status: EventStatus.LIVE } },
        {
          status: FixtureStatus.SCHEDULED,
          startsAt: { gte: now, lte: prestartUntil },
        },
      ],
    },
    select: { league: { select: { key: true } } },
  });

  return [...new Set(fixtures.map((row) => row.league.key))].sort();
}
