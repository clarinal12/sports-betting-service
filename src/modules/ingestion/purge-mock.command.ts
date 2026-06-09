import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from './ingestion.service';

/**
 * Standalone entrypoint: `npm run ingest:purge-mock`.
 * Removes mock fixtures (and cascaded events/markets/selections) plus orphan mock teams.
 * Keeps casino groups, staff, and fixtures with placed bets.
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
      `Mock catalog purge completed: fixturesRemoved=${summary.fixturesRemoved}, fixturesSkipped=${summary.fixturesSkipped}, teamsRemoved=${summary.teamsRemoved}`,
    );
    if (summary.fixturesSkipped > 0) {
      logger.warn(
        `${summary.fixturesSkipped} mock fixture(s) kept because they have placed bets`,
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
