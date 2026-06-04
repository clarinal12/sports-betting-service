import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from './ingestion.service';
import { SettlementService } from '../settlement/settlement.service';

/**
 * Manual final result when The Odds API no longer returns the event on /scores.
 *
 *   npm run result:manual -- --event fd1e64710aa2e27f2e169c43a290c3c3 --home 3 --away 2
 */
function parseArgs(argv: string[]): {
  eventRef: string;
  home: number;
  away: number;
} {
  let eventRef = '';
  let home = NaN;
  let away = NaN;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--event' || arg === '-e') {
      eventRef = argv[i + 1] ?? '';
      i += 1;
    } else if (arg === '--home' || arg === '-h') {
      home = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--away' || arg === '-a') {
      away = Number(argv[i + 1]);
      i += 1;
    }
  }
  if (!eventRef || !Number.isFinite(home) || !Number.isFinite(away)) {
    throw new Error(
      'Usage: npm run result:manual -- --event <providerRef> --home <int> --away <int>',
    );
  }
  return { eventRef, home, away };
}

async function run(): Promise<void> {
  const logger = new Logger('ManualResultCommand');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const { eventRef, home, away } = parseArgs(process.argv.slice(2));
    const ingestion = app.get(IngestionService);
    const settlement = app.get(SettlementService);

    const eventId = await ingestion.finalizeEventResult(eventRef, home, away);
    if (!eventId) {
      logger.error(`Event not found for providerRef=${eventRef}`);
      process.exitCode = 1;
      return;
    }
    logger.log(
      `Event ${eventRef} marked ENDED (${home}-${away}); markets SETTLED`,
    );

    const settled = await settlement.settleBatch();
    logger.log(`Settlement completed (${settled} bet(s) settled)`);
  } catch (error) {
    logger.error('Manual result failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
