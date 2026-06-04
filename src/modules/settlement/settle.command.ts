import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SettlementService } from './settlement.service';

/**
 * Standalone entrypoint: `npm run settle`.
 */
async function run(): Promise<void> {
  const logger = new Logger('SettleCommand');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const settlement = app.get(SettlementService);
    const count = await settlement.settleBatch();
    if (count === 0) {
      await settlement.logWhyAcceptedBetsAreUnsettled();
    }
    logger.log(`Settlement completed (${count} bet(s) settled)`);
  } catch (error) {
    logger.error('Settlement failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
