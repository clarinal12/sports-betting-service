import { Prisma } from '@prisma/client';

/**
 * Prisma's Decimal preserves precision; we serialize it to a string in API
 * responses so JSON consumers never receive a lossy float. Prices and stakes
 * must never round-trip through a JS `number` (FR-M6).
 */
export function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

export function nullableDecimalToString(
  value: Prisma.Decimal | null,
): string | null {
  return value === null ? null : value.toString();
}
