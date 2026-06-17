import type { WalletTransactionRequest } from './wallet.port';

/** Bet placement debit — single POST /transaction. */
export const WALLET_OUTBOX_DEBIT = 'WALLET_RESERVE';

/** Auto settlement (win / lost / void) — sent via POST /batch-transactions. */
export const WALLET_OUTBOX_SETTLE = 'WALLET_SETTLE';

/** Staff manual void refund — single POST /transaction. */
export const WALLET_OUTBOX_STAFF_VOID = 'WALLET_STAFF_VOID';

export type StoredWalletTransaction = Omit<
  WalletTransactionRequest,
  'createdAt'
> & { createdAt: string };

export function serializeWalletTransaction(
  request: WalletTransactionRequest,
): StoredWalletTransaction {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
  };
}

export function deserializeWalletTransaction(
  payload: unknown,
): WalletTransactionRequest {
  const row = payload as StoredWalletTransaction;
  return {
    ...row,
    createdAt: new Date(row.createdAt),
  };
}
