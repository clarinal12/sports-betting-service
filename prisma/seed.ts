import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { PrismaService } from '../src/shared/database/prisma.service';

/**
 * Demo data for local development:
 *  - Catalog + fixtures via the mock provider (ingestion).
 *  - Two casino groups with different enabled-league sets, so tenant scoping
 *    is observable: `acme` offers everything, `betzone` only soccer.
 */
async function seed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const ingestion = app.get(IngestionService);

    await ingestion.ingestFixtures();

    const acme = await prisma.casinoGroup.upsert({
      where: { slug: 'acme' },
      create: { slug: 'acme', name: 'Acme Casino', defaultCurrency: 'USD' },
      update: { name: 'Acme Casino' },
    });
    const betzone = await prisma.casinoGroup.upsert({
      where: { slug: 'betzone' },
      create: { slug: 'betzone', name: 'BetZone', defaultCurrency: 'EUR' },
      update: { name: 'BetZone' },
    });

    const leagues = await prisma.league.findMany({
      select: { id: true, key: true },
    });
    const leagueId = (key: string): string => {
      const found = leagues.find((l) => l.key === key);
      if (!found) {
        throw new Error(`Seed expected league ${key} to exist after ingestion`);
      }
      return found.id;
    };

    // Acme: all leagues enabled.
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
    }

    // BetZone: only soccer leagues enabled (NBA present but disabled).
    const betzoneLeagues: { key: string; enabled: boolean }[] = [
      { key: 'soccer_epl', enabled: true },
      { key: 'soccer_laliga', enabled: true },
      { key: 'basketball_nba', enabled: false },
    ];
    for (const entry of betzoneLeagues) {
      await prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: betzone.id,
            leagueId: leagueId(entry.key),
          },
        },
        create: {
          casinoGroupId: betzone.id,
          leagueId: leagueId(entry.key),
          enabled: entry.enabled,
        },
        update: { enabled: entry.enabled },
      });
    }

    logger.log('Seed completed: groups=acme,betzone');
  } catch (error) {
    new Logger('Seed').error('Seed failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seed();
