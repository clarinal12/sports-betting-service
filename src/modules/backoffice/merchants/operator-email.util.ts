/** Default back-office login email for a new merchant tenant. */
export function defaultOperatorEmail(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return `admin@${normalized}.merchant.local`;
}
