import { VerifiedTextCache } from '../../../../src/knowledge/retrieval/verified-text-cache';

const H1 = `sha256:${'1'.repeat(64)}`;
const H2 = `sha256:${'2'.repeat(64)}`;

describe('VerifiedTextCache (S2 optional bounded LRU)', () => {
  it('returns a text only for the exact (key, verified hash) it was stored under', () => {
    const c = new VerifiedTextCache(1000);
    c.set('k', H1, 'texto v1');
    expect(c.get('k', H1)).toBe('texto v1');
    expect(c.get('k', H2)).toBeUndefined(); // replaced text → new hash → never served from the cache
    expect(c.get('other', H1)).toBeUndefined();
  });

  it('evicts least recently used entries to stay within the byte budget (UTF-16 × 2)', () => {
    const c = new VerifiedTextCache(40); // 20 UTF-16 units
    c.set('a', H1, 'x'.repeat(8));
    c.set('b', H1, 'y'.repeat(8));
    c.get('a', H1); // a is now most recent
    c.set('c', H1, 'z'.repeat(8)); // 48 bytes > 40 → evict b
    expect(c.get('b', H1)).toBeUndefined();
    expect(c.get('a', H1)).toBe('x'.repeat(8));
    expect(c.get('c', H1)).toBe('z'.repeat(8));
    expect(c.size).toEqual({ entries: 2, bytes: 32 });
  });

  it('replacing an entry updates the accounting; oversize texts and a zero budget are never cached', () => {
    const c = new VerifiedTextCache(40);
    c.set('a', H1, 'x'.repeat(10));
    c.set('a', H1, 'x'.repeat(4));
    expect(c.size).toEqual({ entries: 1, bytes: 8 });
    c.set('big', H1, 'x'.repeat(21));
    expect(c.get('big', H1)).toBeUndefined();
    const off = new VerifiedTextCache(0);
    off.set('a', H1, 'x');
    expect(off.get('a', H1)).toBeUndefined();
    c.clear();
    expect(c.size).toEqual({ entries: 0, bytes: 0 });
  });
});
