import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';
import { CircuitBreaker } from '../../shared/resilience/circuit-breaker';
import { merchantBasicAuthHeader } from './wallet-auth.util';
import {
  WalletBalance,
  WalletBatchCreditRequest,
  WalletBatchCreditResult,
  WalletCreditRequest,
  WalletCreditResult,
  WalletPort,
  WalletReserveError,
  WalletReserveRequest,
  WalletReserveResult,
} from './wallet.port';

const REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class WalletHttpClient implements WalletPort {
  private readonly logger = new Logger(WalletHttpClient.name);
  private readonly breaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 10_000,
  });

  constructor(
    private readonly http: HttpService,
    private readonly casinoGroups: CasinoGroupsService,
  ) {}

  async getBalance(
    userCode: string,
    casinoGroupId: string,
  ): Promise<WalletBalance> {
    const config = await this.requireWalletConfig(casinoGroupId);
    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<{
            success: boolean;
            message: string | number;
            errorCode: number;
          }>(
            `${config.apiUrl}/balance`,
            { userCode },
            {
              timeout: REQUEST_TIMEOUT_MS,
              headers: {
                ...this.authHeaders(config),
                'Content-Type': 'application/json',
              },
            },
          ),
        );
        if (!response.data.success || response.data.errorCode !== 0) {
          throw new WalletReserveError(
            'Wallet balance lookup rejected',
            'UNAVAILABLE',
          );
        }
        return {
          balance: String(response.data.message),
          currency: config.currency,
        };
      });
    } catch (error) {
      if (error instanceof WalletReserveError) {
        throw error;
      }
      this.logger.warn(
        `Wallet balance lookup failed for user ${userCode}: ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  async reserve(request: WalletReserveRequest): Promise<WalletReserveResult> {
    const config = await this.requireWalletConfig(request.casinoGroupId);
    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<{ transactionId: string }>(
            `${config.apiUrl}/transaction`,
            {
              userId: request.userId,
              amount: request.amount,
              currency: request.currency,
              reference: request.reference,
              idempotencyKey: request.idempotencyKey,
              action: 'DEBIT',
              type: 'BET',
            },
            {
              timeout: REQUEST_TIMEOUT_MS,
              headers: this.authHeaders(config),
            },
          ),
        );
        return { reservationId: response.data.transactionId };
      });
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 402 || status === 409 || status === 400) {
          throw new WalletReserveError(
            'Insufficient balance',
            'INSUFFICIENT_FUNDS',
          );
        }
      }
      this.logger.warn(
        `Wallet bet debit failed for bet ${request.reference}: ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  async creditPayout(request: WalletCreditRequest): Promise<WalletCreditResult> {
    const config = await this.requireWalletConfig(request.casinoGroupId);
    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<{ transactionId: string }>(
            `${config.apiUrl}/transaction`,
            {
              userId: request.userId,
              amount: request.amount,
              currency: request.currency,
              reference: request.reference,
              idempotencyKey: request.idempotencyKey,
              action: 'CREDIT',
              type: request.type === 'WIN' ? 'WIN' : 'VOID',
            },
            {
              timeout: REQUEST_TIMEOUT_MS,
              headers: this.authHeaders(config),
            },
          ),
        );
        return { transactionId: response.data.transactionId };
      });
    } catch (error) {
      this.logger.warn(
        `Wallet void credit failed for bet ${request.reference}: ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  async creditPayoutBatch(
    request: WalletBatchCreditRequest,
  ): Promise<WalletBatchCreditResult> {
    if (request.items.length === 0) {
      return { transactionIds: [] };
    }

    const config = await this.requireWalletConfig(request.casinoGroupId);
    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<{ transactionIds: string[] }>(
            `${config.apiUrl}/batch-transactions`,
            {
              batchId: request.batchId,
              transactions: request.items.map((item) => ({
                userId: item.userId,
                amount: item.amount,
                currency: item.currency,
                reference: item.reference,
                idempotencyKey: item.idempotencyKey,
                type: item.type,
              })),
            },
            {
              timeout: REQUEST_TIMEOUT_MS,
              headers: this.authHeaders(config),
            },
          ),
        );
        return {
          transactionIds: response.data.transactionIds ?? [],
        };
      });
    } catch (error) {
      this.logger.warn(
        `Wallet batch settlement failed (${request.items.length} items): ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  private authHeaders(config: {
    merchantId: string;
    sportsSecret: string;
  }): Record<string, string> {
    return {
      Authorization: merchantBasicAuthHeader(
        config.merchantId,
        config.sportsSecret,
      ),
    };
  }

  private async requireWalletConfig(casinoGroupId: string) {
    const config = await this.casinoGroups.getWalletConfig(casinoGroupId);
    if (!config) {
      throw new WalletReserveError(
        'Merchant wallet API not configured',
        'UNAVAILABLE',
      );
    }
    return config;
  }
}
