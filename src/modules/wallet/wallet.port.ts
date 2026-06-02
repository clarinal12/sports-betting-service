/**
 * Balance is a string to preserve decimal precision (never a JS number).
 */
export interface WalletBalance {
  balance: string;
  currency: string;
}

/**
 * Contract for the external user/wallet service. Phase 3a ships a resilient
 * client skeleton; actual balance reads and reserve/commit land in Phase 4.
 */
export interface WalletPort {
  getBalance(userId: string, casinoGroupId: string): Promise<WalletBalance>;
}

export const WALLET_PORT = Symbol('WALLET_PORT');
