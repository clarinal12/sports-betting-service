import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';
import { CircuitBreaker } from '../../shared/resilience/circuit-breaker';
import { merchantBasicAuthHeader } from './wallet-auth.util';
import { toMerchantTransactionBody } from './wallet-transaction.builder';
import {
  WalletBalance,
  WalletPort,
  WalletReserveError,
  WalletTransactionRequest,
  WalletTransactionResult,
} from './wallet.port';

const REQUEST_TIMEOUT_MS = 5000;

interface MerchantWalletResponse {
  success: boolean;
  message?: string | number;
  errorCode: number;
}

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
          this.http.post<MerchantWalletResponse>(
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

  async postTransaction(
    request: WalletTransactionRequest,
  ): Promise<WalletTransactionResult> {
    const config = await this.requireWalletConfig(request.casinoGroupId);
    const body = toMerchantTransactionBody(request);

    try {
      return await this.breaker.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<MerchantWalletResponse>(
            `${config.apiUrl}/transaction`,
            body,
            {
              timeout: REQUEST_TIMEOUT_MS,
              headers: {
                ...this.authHeaders(config),
                'Content-Type': 'application/json',
              },
            },
          ),
        );
        return this.parseTransactionResponse(response.data, request);
      });
    } catch (error) {
      if (error instanceof WalletReserveError) {
        throw error;
      }
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data as MerchantWalletResponse | undefined;
        if (data) {
          try {
            return this.parseTransactionResponse(data, request);
          } catch (parsed) {
            if (parsed instanceof WalletReserveError) {
              throw parsed;
            }
          }
        }
        if (
          status === 402 ||
          status === 409 ||
          status === 400
        ) {
          throw new WalletReserveError(
            'Insufficient balance',
            'INSUFFICIENT_FUNDS',
          );
        }
      }
      this.logger.warn(
        `Wallet transaction failed (${request.transactionCode}): ${
          (error as Error).message
        }`,
      );
      throw new WalletReserveError('Wallet service unavailable', 'UNAVAILABLE');
    }
  }

  private parseTransactionResponse(
    data: MerchantWalletResponse,
    request: WalletTransactionRequest,
  ): WalletTransactionResult {
    if (data.success && data.errorCode === 0) {
      const id =
        typeof data.message === 'string' && data.message.length > 0
          ? data.message
          : request.transactionCode;
      return { transactionId: id };
    }

    if (this.isDuplicateTransaction(data)) {
      return { transactionId: request.transactionCode };
    }

    const amount = Number.parseFloat(request.amount);
    if (amount < 0) {
      throw new WalletReserveError('Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    throw new WalletReserveError('Wallet transaction rejected', 'UNAVAILABLE');
  }

  private isDuplicateTransaction(data: MerchantWalletResponse): boolean {
    if (data.errorCode === 0) {
      return false;
    }
    const hint = String(data.message ?? '').toUpperCase();
    return hint.includes('DUPLICATE');
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
