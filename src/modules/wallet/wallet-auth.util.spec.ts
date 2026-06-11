import {
  merchantBasicAuthHeader,
  normalizeWalletApiUrl,
} from './wallet-auth.util';

describe('wallet-auth.util', () => {
  it('builds Basic auth from merchantId and sportsSecret', () => {
    const header = merchantBasicAuthHeader('acme-merchant', 'secret-value');
    expect(header).toBe(
      `Basic ${Buffer.from('acme-merchant:secret-value', 'utf8').toString('base64')}`,
    );
  });

  it('strips trailing slashes from wallet API URLs', () => {
    expect(normalizeWalletApiUrl('https://wallet.example.com/')).toBe(
      'https://wallet.example.com',
    );
  });
});
