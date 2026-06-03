import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from './ingestion.service';

/**
 * Standalone entrypoint: `npm run ingest:live`.
 * Polls scores/odds only for leagues with LIVE or soon-to-start fixtures in the DB.
 */
async function run(): Promise<void> {
  const logger = new Logger('IngestLiveCommand');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestion = app.get(IngestionService);
    const summary = await ingestion.ingestLiveTick();
    if (summary.skipped) {
      logger.log('Live ingest skipped (no scoped fixtures in DB)');
    } else {
      logger.log(
        `Live ingest completed for ${summary.sportKeys.join(', ')}`,
      );
    }
  } catch (error) {
    logger.error('Live ingest failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
