import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ResultsIngestService } from './results-ingest.service';

/**
 * Bet-driven results ingest + settlement: `npm run ingest:results`
 */
async function run(): Promise<void> {
  const logger = new Logger('IngestResultsCommand');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const results = app.get(ResultsIngestService);
    const summary = await results.runResultsAndSettlement();
    logger.log(
      `Results + settlement completed: settled=${summary.betsSettled} eventsUpdated=${summary.eventsUpdated} scores=${summary.scoresReturned} staleFlags=${summary.betsFlaggedStale}`,
    );
  } catch (error) {
    logger.error('Results ingest failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
