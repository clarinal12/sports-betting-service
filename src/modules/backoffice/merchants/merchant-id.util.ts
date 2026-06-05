/** Default launch-JWT merchant id when the operator does not supply one. */
export function defaultMerchantIdFromSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return normalized.length > 0 ? `${normalized}-merchant` : '';
}
