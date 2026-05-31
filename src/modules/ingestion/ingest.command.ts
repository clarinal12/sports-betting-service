import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from './ingestion.service';

/**
 * Standalone entrypoint: `npm run ingest:fixtures`.
 * Phase 1 runs ingestion manually; scheduled ingestion (BullMQ/cron) is added
 * in a later phase.
 */
async function run(): Promise<void> {
  const logger = new Logger('IngestCommand');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestion = app.get(IngestionService);
    await ingestion.ingestFixtures();
    logger.log('Fixture ingestion completed');
  } catch (error) {
    logger.error('Fixture ingestion failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
