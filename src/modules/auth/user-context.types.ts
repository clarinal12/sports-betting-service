/**
 * The authenticated player for a request, built from a verified session token.
 * Not persisted. `casinoGroupId`/`currency` come from our CasinoGroup record
 * (resolved via the operator's merchantId), not from the token itself.
 */
export interface UserContext {
  userId: string;
  username: string;
  casinoGroupId: string;
  currency: string;
}

/** Decoded payload of an operator launch token (signed HS256 per merchant). */
export interface OperatorTokenPayload {
  userId: string;
  username: string;
  merchantId: string;
  iat?: number;
  exp?: number;
}

/** Claims we put in our own session token. */
export interface SessionTokenClaims {
  sub: string;
  username: string;
  casinoGroupId: string;
  currency: string;
}

declare module 'express' {
  interface Request {
    user?: UserContext;
  }
}
