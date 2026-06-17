import { createHash } from 'crypto';

/**
 * Stable numeric `historyId` for a sporting event (merchant wallet API `long`).
 * Derived from our internal event id — same event always maps to the same id.
 */
export function eventWalletHistoryId(eventId: string): number {
  const digest = createHash('sha256')
    .update(`wallet-history:${eventId}`, 'utf8')
    .digest();
  let value = 0n;
  for (let i = 0; i < 6; i++) {
    value = (value << 8n) | BigInt(digest[i]!);
  }
  return Number(value);
}
