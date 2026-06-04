import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { EnvConfig } from '../../shared/config/env.validation';
import { CircuitBreaker } from '../../shared/resilience/circuit-breaker';
import {
  WalletBalance,
  WalletCreditRequest,
  WalletCreditResult,
  WalletPort,
  WalletReserveError,
  WalletReserveRequest,
  WalletReserveResult,
} from './wallet.port';

const REQUEST_TIMEOUT_MS = 2000;

@Injectable()
export class WalletHttpClient implements WalletPort {
  private readonly logger = new Logger(WalletHttpClient.name);
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
    const baseUrl = this.requireBaseUrl();
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
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  async reserve(request: WalletReserveRequest): Promise<WalletReserveResult> {
    const baseUrl = this.requireBaseUrl();
    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<{ reservationId: string }>(
            `${baseUrl}/wallet/reserve`,
            {
              userId: request.userId,
              casinoGroupId: request.casinoGroupId,
              amount: request.amount,
              currency: request.currency,
              reference: request.reference,
              idempotencyKey: request.idempotencyKey,
            },
            { timeout: REQUEST_TIMEOUT_MS },
          ),
        );
        return { reservationId: response.data.reservationId };
      });
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 402 || status === 409) {
          throw new WalletReserveError(
            'Insufficient balance',
            'INSUFFICIENT_FUNDS',
          );
        }
      }
      this.logger.warn(
        `Wallet reserve failed for bet ${request.reference}: ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  async creditPayout(request: WalletCreditRequest): Promise<WalletCreditResult> {
    const baseUrl = this.requireBaseUrl();
    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<{ transactionId: string }>(
            `${baseUrl}/wallet/credit`,
            {
              userId: request.userId,
              casinoGroupId: request.casinoGroupId,
              amount: request.amount,
              currency: request.currency,
              reference: request.reference,
              idempotencyKey: request.idempotencyKey,
              type: request.type,
            },
            { timeout: REQUEST_TIMEOUT_MS },
          ),
        );
        return { transactionId: response.data.transactionId };
      });
    } catch (error) {
      this.logger.warn(
        `Wallet credit failed for bet ${request.reference}: ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  private requireBaseUrl(): string {
    const baseUrl = this.config.get('USER_SERVICE_BASE_URL', { infer: true });
    if (!baseUrl) {
      throw new WalletReserveError('User service not configured', 'UNAVAILABLE');
    }
    return baseUrl;
  }
}
