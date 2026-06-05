import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import {
  ACME_INGEST_SPORT_KEYS,
  ACME_LEAGUE_PREFIXES,
  BETZONE_LEAGUE_PREFIXES,
  isLeagueOffered,
} from '../src/modules/casino-groups/tenant-offering.config';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import { CryptoService } from '../src/shared/crypto/crypto.service';

// Demo launch-token secrets (dev only). The dev:token script reads these to
// sign operator JWTs.
const DEMO_MERCHANTS = {
  acme: { merchantId: 'acme-merchant', sportsSecret: 'acme-dev-secret-please-change' },
  betzone: {
    merchantId: 'betzone-merchant',
    sportsSecret: 'betzone-dev-secret-please-change',
  },
};

/**
 * Demo data for local development (Odds API ingest + tenant league scoping):
 *  - acme & betzone: NBA only (`basketball_nba`)
 */
async function seed(): Promise<void> {
  const logger = new Logger('Seed');

  if (process.env.FIXTURE_PROVIDER === 'odds-api' && !process.env.ODDS_API_SPORT_KEYS) {
    process.env.ODDS_API_SPORT_KEYS = ACME_INGEST_SPORT_KEYS;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const ingestion = app.get(IngestionService);
    const crypto = app.get(CryptoService);

    await ingestion.ingestFixtures();

    const acme = await prisma.casinoGroup.upsert({
      where: { slug: 'acme' },
      create: {
        slug: 'acme',
        name: 'Acme Casino',
        defaultCurrency: 'USD',
        merchantId: DEMO_MERCHANTS.acme.merchantId,
        sportsSecret: crypto.encrypt(DEMO_MERCHANTS.acme.sportsSecret),
      },
      update: {
        name: 'Acme Casino',
        merchantId: DEMO_MERCHANTS.acme.merchantId,
        sportsSecret: crypto.encrypt(DEMO_MERCHANTS.acme.sportsSecret),
      },
    });
    const betzone = await prisma.casinoGroup.upsert({
      where: { slug: 'betzone' },
      create: {
        slug: 'betzone',
        name: 'BetZone',
        defaultCurrency: 'EUR',
        merchantId: DEMO_MERCHANTS.betzone.merchantId,
        sportsSecret: crypto.encrypt(DEMO_MERCHANTS.betzone.sportsSecret),
      },
      update: {
        name: 'BetZone',
        merchantId: DEMO_MERCHANTS.betzone.merchantId,
        sportsSecret: crypto.encrypt(DEMO_MERCHANTS.betzone.sportsSecret),
      },
    });

    const leagues = await prisma.league.findMany({
      select: { id: true, key: true },
    });

    for (const league of leagues) {
      const acmeEnabled = isLeagueOffered(league.key, ACME_LEAGUE_PREFIXES);
      await prisma.casinoGroupLeague.upsert({
        where: {
          casinoGroupId_leagueId: {
            casinoGroupId: acme.id,
            leagueId: league.id,
          },
        },
        create: {
          casinoGroupId: acme.id,
          leagueId: league.id,
          enabled: acmeEnabled,
        },
        update: { enabled: acmeEnabled },
      });

      const betzoneEnabled = isLeagueOffered(league.key, BETZONE_LEAGUE_PREFIXES);
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
          enabled: betzoneEnabled,
        },
        update: { enabled: betzoneEnabled },
      });
    }

    logger.log(
      'Seed completed: groups=acme,betzone (merchants: acme-merchant, betzone-merchant)',
    );
  } catch (error) {
    new Logger('Seed').error('Seed failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seed();
