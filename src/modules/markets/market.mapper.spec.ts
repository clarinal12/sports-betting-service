import { Prisma } from '@prisma/client';
import { toMarketDto } from './market.mapper';

describe('toMarketDto', () => {
  it('maps a market with decimal prices to string fields', () => {
    const dto = toMarketDto({
      id: 'mkt_1',
      eventId: 'evt_1',
      type: 'TOTAL',
      status: 'OPEN',
      line: new Prisma.Decimal('2.50'),
      selections: [
        {
          id: 'sel_1',
          name: 'Over',
          status: 'OPEN',
          price: new Prisma.Decimal('1.90'),
        },
        {
          id: 'sel_2',
          name: 'Under',
          status: 'OPEN',
          price: new Prisma.Decimal('1.90'),
        },
      ],
    });

    expect(dto.line).toBe('2.5');
    expect(dto.selections.map((s) => s.price)).toEqual(['1.9', '1.9']);
    expect(typeof dto.selections[0].price).toBe('string');
  });

  it('keeps a null line as null', () => {
    const dto = toMarketDto({
      id: 'mkt_2',
      eventId: 'evt_1',
      type: 'MATCH_RESULT',
      status: 'OPEN',
      line: null,
      selections: [],
    });
    expect(dto.line).toBeNull();
  });
});
