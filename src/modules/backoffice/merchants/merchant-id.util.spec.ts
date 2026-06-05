import { defaultMerchantIdFromSlug } from './merchant-id.util';

describe('defaultMerchantIdFromSlug', () => {
  it('appends -merchant to the slug', () => {
    expect(defaultMerchantIdFromSlug('luckystar')).toBe('luckystar-merchant');
    expect(defaultMerchantIdFromSlug('acme')).toBe('acme-merchant');
  });

  it('trims and lowercases the slug', () => {
    expect(defaultMerchantIdFromSlug('  LuckyStar  ')).toBe('luckystar-merchant');
  });
});
