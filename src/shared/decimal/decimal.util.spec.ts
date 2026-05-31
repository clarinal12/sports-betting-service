import { Prisma } from '@prisma/client';
import { decimalToString, nullableDecimalToString } from './decimal.util';

describe('decimal util', () => {
  it('serializes a Decimal to a string', () => {
    expect(decimalToString(new Prisma.Decimal('2.10'))).toBe('2.1');
    expect(decimalToString(new Prisma.Decimal('218.5'))).toBe('218.5');
  });

  it('preserves precision beyond float-safe range', () => {
    const value = new Prisma.Decimal('1.005');
    expect(decimalToString(value)).toBe('1.005');
  });

  it('passes through null for nullable lines', () => {
    expect(nullableDecimalToString(null)).toBeNull();
    expect(nullableDecimalToString(new Prisma.Decimal('-4.5'))).toBe('-4.5');
  });
});
