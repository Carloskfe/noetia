/**
 * NEM-023 §5.1 (S2) optional bounded in-memory LRU of book texts that ALREADY passed hash verification.
 *
 * - Keyed by (object key, verified textHash): an entry is only ever returned for the exact hash it was verified
 *   against, so a replaced text (new current hash) can never be served from it.
 * - Bounded by an approximate byte budget (UTF-16 length × 2); least recently used entries are evicted. A text larger
 *   than the whole budget is not cached. Budget 0 disables the cache.
 * - Process memory only: no persistence, never logged, never in metrics.
 */
export class VerifiedTextCache {
  private readonly entries = new Map<string, string>();
  private bytes = 0;

  constructor(private readonly maxBytes: number) {}

  private static key(objectKey: string, textHash: string) {
    return `${textHash}\u0000${objectKey}`;
  }

  get(objectKey: string, textHash: string): string | undefined {
    const k = VerifiedTextCache.key(objectKey, textHash);
    const v = this.entries.get(k);
    if (v === undefined) return undefined;
    this.entries.delete(k); // refresh recency
    this.entries.set(k, v);
    return v;
  }

  set(objectKey: string, textHash: string, text: string): void {
    const size = text.length * 2;
    if (this.maxBytes <= 0 || size > this.maxBytes) return;
    const k = VerifiedTextCache.key(objectKey, textHash);
    const prev = this.entries.get(k);
    if (prev !== undefined) {
      this.entries.delete(k);
      this.bytes -= prev.length * 2;
    }
    this.entries.set(k, text);
    this.bytes += size;
    for (const [oldest, v] of this.entries) {
      if (this.bytes <= this.maxBytes) break;
      this.entries.delete(oldest);
      this.bytes -= v.length * 2;
    }
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  get size(): { entries: number; bytes: number } {
    return { entries: this.entries.size, bytes: this.bytes };
  }
}
