import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from './ingestion.service';

/**
 * Standalone entrypoint: `npm run ingest:purge-mock`.
 * Removes mock fixtures without bet history; ends fixtures with voided legs in place.
 * Keeps casino groups, staff, and fixtures with active (PENDING/ACCEPTED) bets.
 */
async function run(): Promise<void> {
  const logger = new Logger('PurgeMockCommand');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestion = app.get(IngestionService);
    const summary = await ingestion.purgeMockCatalog();
    logger.log(
      `Mock catalog purge completed: fixturesRemoved=${summary.fixturesRemoved}, fixturesRetired=${summary.fixturesRetired}, fixturesSkipped=${summary.fixturesSkipped}, teamsRemoved=${summary.teamsRemoved}`,
    );
    if (summary.fixturesRetired > 0) {
      logger.log(
        `${summary.fixturesRetired} mock fixture(s) ended in place (bet history preserved; no longer live)`,
      );
    }
    if (summary.fixturesSkipped > 0) {
      logger.warn(
        `${summary.fixturesSkipped} mock fixture(s) kept because they have active (PENDING/ACCEPTED) bets`,
      );
    }
  } catch (error) {
    logger.error('Mock catalog purge failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
