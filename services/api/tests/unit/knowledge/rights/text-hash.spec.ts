import { createHash } from 'crypto';
import { computeTextHash, TEXT_HASH_PATTERN, TEXT_HASH_PREFIX } from '../../../../src/knowledge/rights/text-hash';

describe('computeTextHash (NEM-023 §9.1)', () => {
  it('is "sha256:" + lowercase hex of the exact bytes', () => {
    const bytes = Buffer.from('Érase una vez…\n', 'utf8');
    const h = computeTextHash(bytes);
    expect(h).toBe(`sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    expect(h.startsWith(TEXT_HASH_PREFIX)).toBe(true);
    expect(h).toMatch(TEXT_HASH_PATTERN);
  });

  it('is byte-exact: no normalization (NFC vs NFD, BOM, trailing newline all differ)', () => {
    const nfc = Buffer.from('canción'.normalize('NFC'));
    const nfd = Buffer.from('canción'.normalize('NFD'));
    expect(computeTextHash(nfc)).not.toBe(computeTextHash(nfd));
    expect(computeTextHash(Buffer.from('a'))).not.toBe(computeTextHash(Buffer.from('﻿a')));
    expect(computeTextHash(Buffer.from('a'))).not.toBe(computeTextHash(Buffer.from('a\n')));
  });

  it('accepts any Uint8Array (including empty and invalid UTF-8) deterministically', () => {
    expect(computeTextHash(new Uint8Array())).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const bad = new Uint8Array([0xff, 0xfe, 0x00]);
    expect(computeTextHash(bad)).toBe(computeTextHash(Uint8Array.from(bad)));
  });
});
