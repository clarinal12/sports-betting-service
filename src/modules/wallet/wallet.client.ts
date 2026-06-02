import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { EnvConfig } from '../../shared/config/env.validation';
import { CircuitBreaker } from '../../shared/resilience/circuit-breaker';
import { WalletBalance, WalletPort } from './wallet.port';

const REQUEST_TIMEOUT_MS = 2000;

/**
 * HTTP client for the external user/wallet service, wrapped in a circuit
 * breaker so a flaky upstream fails fast (open after 5 consecutive failures,
 * half-open after 10s) rather than piling up requests. Identity-sensitive
 * paths fail closed.
 *
 * Phase 3a: skeleton only — `getBalance` is wired but not yet consumed by any
 * route. Bet placement (Phase 4) will use it.
 */
@Injectable()
export class WalletClient implements WalletPort {
  private readonly logger = new Logger(WalletClient.name);
  private readonly breaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 10_000,
  });

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async getBalance(
    userId: string,
    casinoGroupId: string,
  ): Promise<WalletBalance> {
    const baseUrl = this.config.get('USER_SERVICE_BASE_URL', { infer: true });
    if (!baseUrl) {
      throw new ServiceUnavailableException('User service not configured');
    }

    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.get<{ balance: string | number; currency: string }>(
            `${baseUrl}/wallet/balance`,
            { params: { userId, casinoGroupId }, timeout: REQUEST_TIMEOUT_MS },
          ),
        );
        return {
          balance: String(response.data.balance),
          currency: response.data.currency,
        };
      });
    } catch (error) {
      this.logger.warn(
        `Wallet balance lookup failed for user ${userId}: ${
          (error as Error).message
        }`,
      );
      throw new ServiceUnavailableException('Wallet service unavailable');
    }
  }
}
