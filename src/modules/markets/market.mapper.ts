import { Prisma } from '@prisma/client';
import {
  decimalToString,
  nullableDecimalToString,
} from '../../shared/decimal/decimal.util';
import { MarketResponseDto } from './dto/market-response.dto';

export const marketSelect = {
  id: true,
  eventId: true,
  type: true,
  status: true,
  line: true,
  selections: {
    orderBy: { providerRef: 'asc' },
    select: { id: true, name: true, status: true, price: true },
  },
} satisfies Prisma.MarketSelect;

type MarketRow = Prisma.MarketGetPayload<{ select: typeof marketSelect }>;

export function toMarketDto(market: MarketRow): MarketResponseDto {
  return {
    id: market.id,
    eventId: market.eventId,
    type: market.type,
    status: market.status,
    line: nullableDecimalToString(market.line),
    selections: market.selections.map((selection) => ({
      id: selection.id,
      name: selection.name,
      status: selection.status,
      price: decimalToString(selection.price),
    })),
  };
}
