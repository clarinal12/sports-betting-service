/** Tenant-scoped room for live event state (scores, clock, status). */
export function eventRoom(casinoGroupId: string, eventId: string): string {
  return `group:${casinoGroupId}:event:${eventId}`;
}

/** Tenant-scoped room for market/selection odds on an event. */
export function marketRoom(casinoGroupId: string, marketId: string): string {
  return `group:${casinoGroupId}:market:${marketId}`;
}
