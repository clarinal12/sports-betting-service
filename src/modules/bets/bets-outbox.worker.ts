import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EnvConfig } from '../../shared/config/env.validation';
import { WalletOutboxService } from '../wallet/wallet-outbox.service';

const WALLET_OUTBOX_INTERVAL = 'wallet-outbox-poll';

@Injectable()
export class BetsOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BetsOutboxWorker.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly walletOutbox: WalletOutboxService,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') {
      return;
    }
    const seconds = this.config.get('WALLET_OUTBOX_POLL_SECONDS', {
      infer: true,
    });
    const handle = setInterval(() => {
      void this.poll();
    }, seconds * 1000);
    this.schedulerRegistry.addInterval(WALLET_OUTBOX_INTERVAL, handle);
    this.logger.log(
      `Wallet outbox worker enabled: every ${seconds}s (WALLET_OUTBOX_POLL_SECONDS)`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', WALLET_OUTBOX_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(WALLET_OUTBOX_INTERVAL);
    }
  }

  private async poll(): Promise<void> {
    try {
      const count = await this.walletOutbox.processPending();
      if (count > 0) {
        this.logger.log(`Wallet outbox processed ${count} item(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Wallet outbox poll failed: ${(error as Error).message}`,
      );
    }
  }
}
