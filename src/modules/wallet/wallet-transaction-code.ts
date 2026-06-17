import { createHash, randomUUID } from 'crypto';

export type WalletSettlementOutcome = 'WON' | 'LOST' | 'VOID';

/** New UUID for bet debit — persisted in wallet outbox before first send. */
export function newWalletTransactionCode(): string {
  return randomUUID();
}

/** Stable UUID-shaped code for settlement retries (win / lost / void). */
export function settlementTransactionCode(
  betId: string,
  outcome: WalletSettlementOutcome,
): string {
  const digest = createHash('sha256')
    .update(`settlement:${outcome}:${betId}`, 'utf8')
    .digest('hex');
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(12, 15)}`,
    `a${digest.slice(15, 18)}`,
    digest.slice(18, 30),
  ].join('-');
}

/** Staff manual void uses a distinct stable code from auto-settlement void. */
export function staffVoidTransactionCode(betId: string): string {
  const digest = createHash('sha256')
    .update(`staff-void:${betId}`, 'utf8')
    .digest('hex');
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(12, 15)}`,
    `b${digest.slice(15, 18)}`,
    digest.slice(18, 30),
  ].join('-');
}
