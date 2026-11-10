import {
  chunkIdFromRef, chunkRef, citationAnchor, decodeUtf8, DEFAULT_RETRIEVAL_CONFIG, estimateTokens, isUuid,
  PREVIOUS_SET_HARD_CAP_HOURS, RetrievalRequestInvalid, retrievalLanguage,
} from '../../../../src/knowledge/retrieval/retrieval.types';

const ID = '0b6b5f0e-3a8e-4c55-9a43-7d1c2b9e8f10';

describe('retrieval types and helpers', () => {
  it('defaults are the spec §9.4 values; the hard cap is 30 days', () => {
    expect(DEFAULT_RETRIEVAL_CONFIG).toMatchObject({
      chunkTargetChars: 1500, chunkOverlapRatio: 0.1, maxChunksPerBook: 2000, maxIndexBytes: 250 * 1024 * 1024,
      indexStatementTimeoutMs: 60_000, retrievalStatementTimeoutMs: 2_000, maxQueryCodePoints: 500, maxTopK: 20,
      maxBudgetTokens: 8_000, defaultTopK: 8, defaultBudgetTokens: 6_000, previousSetGraceHours: 24,
    });
    expect(Object.isFrozen(DEFAULT_RETRIEVAL_CONFIG)).toBe(true);
    expect(PREVIOUS_SET_HARD_CAP_HOURS).toBe(720);
  });

  it('estimateTokens is a conservative ceil(bytes / 3)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(2);
    expect(estimateTokens('ñ')).toBe(1); // 2 bytes
    expect(estimateTokens('a'.repeat(4000))).toBeGreaterThan(1000); // > the simulator's 4 bytes/token
  });

  it('chunk refs round-trip; anything else is rejected', () => {
    expect(chunkIdFromRef(chunkRef(ID))).toBe(ID);
    for (const bad of ['', 'chunk:', 'chunk:not-a-uuid', `highlight:${ID}`, ID, 42 as any]) expect(chunkIdFromRef(bad)).toBeNull();
    expect(isUuid(ID)).toBe(true);
    expect(isUuid('x')).toBe(false);
  });

  it('citation anchors are textHash:charStart-charEnd', () => {
    expect(citationAnchor({ textHash: 'sha256:ab', charStart: 3, charEnd: 9 })).toBe('sha256:ab:3-9');
  });

  it('books.language maps to es | en | simple', () => {
    expect(['es', 'ES', 'es-MX', 'es_AR'].map(retrievalLanguage)).toEqual(['es', 'es', 'es', 'es']);
    expect(['en', 'en-GB', ' EN '].map(retrievalLanguage)).toEqual(['en', 'en', 'en']);
    expect(['fr', '', null, undefined, 'esperanto'].map(retrievalLanguage)).toEqual(['simple', 'simple', 'simple', 'simple', 'simple']);
  });

  it('decodeUtf8 is strict and keeps a BOM as a code point', () => {
    expect(decodeUtf8(Buffer.from('niño'))).toBe('niño');
    expect(decodeUtf8(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe('﻿a');
    expect(() => decodeUtf8(new Uint8Array([0xc3]))).toThrow();
  });

  it('RetrievalRequestInvalid names only the field', () => {
    const e = new RetrievalRequestInvalid('query');
    expect(e.message).toBe('invalid retrieval request: query');
    expect(e.field).toBe('query');
    expect(e.name).toBe('RetrievalRequestInvalid');
  });
});
