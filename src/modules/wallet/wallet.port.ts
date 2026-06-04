/**
 * Balance is a string to preserve decimal precision (never a JS number).
 */
export interface WalletBalance {
  balance: string;
  currency: string;
}

export interface WalletReserveRequest {
  userId: string;
  casinoGroupId: string;
  amount: string;
  currency: string;
  /** Bet id used as wallet reference. */
  reference: string;
  idempotencyKey: string;
}

export interface WalletReserveResult {
  reservationId: string;
}

export type WalletCreditType = 'WIN' | 'REFUND';

export interface WalletCreditRequest {
  userId: string;
  casinoGroupId: string;
  amount: string;
  currency: string;
  reference: string;
  idempotencyKey: string;
  type: WalletCreditType;
}

export interface WalletCreditResult {
  transactionId: string;
}

export class WalletReserveError extends Error {
  constructor(
    message: string,
    readonly code: 'INSUFFICIENT_FUNDS' | 'UNAVAILABLE',
  ) {
    super(message);
    this.name = 'WalletReserveError';
  }
}

/**
 * Contract for the external user/wallet service.
 */
export interface WalletPort {
  getBalance(userId: string, casinoGroupId: string): Promise<WalletBalance>;
  reserve(request: WalletReserveRequest): Promise<WalletReserveResult>;
  creditPayout(request: WalletCreditRequest): Promise<WalletCreditResult>;
}

export const WALLET_PORT = Symbol('WALLET_PORT');
