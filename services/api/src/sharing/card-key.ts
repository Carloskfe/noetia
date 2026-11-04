// image-gen stores every card as images/<uuid4>.png (image-gen/storage.py).
const CARD_KEY_RE = /\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png)$/i;

/** Storage key of a quote-card image URL, or null if it isn't one of ours. */
export function cardKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = CARD_KEY_RE.exec(url);
  return m ? m[1] : null;
}
