import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../../app.module';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';

/**
 * Dev helper: sign a fake operator launch token for a merchant, using that
 * merchant's stored sportsSecret. Usage:
 *   npm run dev:token -- --merchant acme-merchant [--user u123] [--username alice]
 */
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i += 1;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

async function run(): Promise<void> {
  const logger = new Logger('DevToken');
  const args = parseArgs(process.argv.slice(2));
  const merchantId = args.merchant ?? 'acme-merchant';
  const userId = args.user ?? 'dev-user-1';
  const username = args.username ?? 'dev-player';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const casinoGroups = app.get(CasinoGroupsService);
    const credentials = await casinoGroups.getMerchantCredentials(merchantId);
    if (!credentials) {
      logger.error(
        `No active merchant '${merchantId}' with a sportsSecret. Run npm run db:seed first.`,
      );
      process.exitCode = 1;
      return;
    }

    const token = jwt.sign(
      { userId, username, merchantId },
      credentials.sportsSecret,
      {
        algorithm: 'HS256',
        expiresIn: '12h',
      },
    );

    console.log(token);
    logger.log(
      `Signed launch token for merchant=${merchantId} user=${userId} (valid 12h)`,
    );
  } finally {
    await app.close();
  }
}

void run();
