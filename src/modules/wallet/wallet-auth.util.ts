/**
 * Basic auth for merchant wallet API calls: base64(merchantId:sportsSecret).
 */
export function merchantBasicAuthHeader(
  merchantId: string,
  sportsSecret: string,
): string {
  const credentials = Buffer.from(`${merchantId}:${sportsSecret}`, 'utf8').toString(
    'base64',
  );
  return `Basic ${credentials}`;
}

export function normalizeWalletApiUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
