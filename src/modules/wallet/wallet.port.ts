/**
 * Balance is a string to preserve decimal precision (never a JS number).
 */
export interface WalletBalance {
  balance: string;
  currency: string;
}

export interface WalletTransactionRequest {
  userCode: string;
  casinoGroupId: string;
  roundId: string;
  transactionCode: string;
  historyId: number;
  gameCode: string;
  gameType: number;
  isFinished: boolean;
  isCanceled: boolean;
  amount: string;
  detail: string;
  createdAt: Date;
}

export interface WalletTransactionResult {
  transactionId: string;
}

export interface WalletBatchTransactionRequest {
  casinoGroupId: string;
  batchId: string;
  transactions: WalletTransactionRequest[];
}

export interface WalletBatchTransactionResult {
  batchId: string;
}

export class WalletReserveError extends Error {
  constructor(
    message: string,
    readonly code: 'INSUFFICIENT_FUNDS' | 'UNAVAILABLE' | 'DUPLICATE',
  ) {
    super(message);
    this.name = 'WalletReserveError';
  }
}

/**
 * Contract for the external user/wallet service.
 */
export interface WalletPort {
  /** @param userCode Operator username sent to the merchant wallet as `userCode`. */
  getBalance(userCode: string, casinoGroupId: string): Promise<WalletBalance>;
  postTransaction(
    request: WalletTransactionRequest,
  ): Promise<WalletTransactionResult>;
  postTransactionBatch(
    request: WalletBatchTransactionRequest,
  ): Promise<WalletBatchTransactionResult>;
}

export const WALLET_PORT = Symbol('WALLET_PORT');
