export const CASINO_GROUP_HEADER = 'x-casino-group';

/**
 * Resolved tenant attached to the request by CasinoGroupGuard.
 * In Phase 3 this is populated from the player JWT instead of a header,
 * without changing the shape consumed by controllers/services.
 */
export interface CasinoGroupContext {
  id: string;
  slug: string;
  name: string;
  defaultCurrency: string;
  timezone: string;
}

declare module 'express' {
  interface Request {
    casinoGroup?: CasinoGroupContext;
  }
}
