import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  QuoteIntegrityService,
  checkQuoteAgainstSource,
  normalizeWording,
} from '../../../src/sharing/quote-integrity.service';
import { SyncMap } from '../../../src/books/sync-map.entity';
import { StorageService } from '../../../src/storage/storage.service';
import { Book } from '../../../src/books/book.entity';

const SOURCE = normalizeWording(
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo ' +
    'que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. ' +
    'Una olla de algo más vaca que carnero, salpicón las más noches.',
);

describe('normalizeWording', () => {
  it('folds case, quote styles, punctuation and whitespace but keeps accents', () => {
    expect(normalizeWording('  «Él dijo:  “¡No!”»\n')).toBe('él dijo no');
  });

  it('removes soft hyphens so hyphenated source text still matches', () => {
    expect(normalizeWording('astil­lero')).toBe('astillero');
  });
});

describe('checkQuoteAgainstSource', () => {
  it('accepts an exact contiguous excerpt', () => {
    expect(checkQuoteAgainstSource('de cuyo nombre no quiero acordarme', SOURCE)).toEqual({ ok: true, segments: 1 });
  });

  it('accepts a shortened excerpt with different punctuation, quotes and capitalisation', () => {
    expect(checkQuoteAgainstSource('“Adarga antigua — rocín flaco y galgo corredor”', SOURCE).ok).toBe(true);
  });

  it('accepts edge truncation marks', () => {
    expect(checkQuoteAgainstSource('… un hidalgo de los de lanza en astillero…', SOURCE).ok).toBe(true);
  });

  it('rejects edited wording presented as the author\'s', () => {
    expect(checkQuoteAgainstSource('de cuyo nombre sí quiero acordarme', SOURCE)).toEqual({ ok: false, reason: 'not_in_source' });
  });

  it('rejects a paraphrase', () => {
    expect(checkQuoteAgainstSource('Vivía en la Mancha un hidalgo pobre', SOURCE).ok).toBe(false);
  });

  it('does not match across word boundaries (no partial words)', () => {
    expect(checkQuoteAgainstSource('ancha de cuyo', SOURCE).ok).toBe(false);
  });

  it('accepts internal omissions ([…], (…), …, ...) when passages are verbatim and in order', () => {
    for (const mark of ['[…]', '[...]', '(…)', '…', '...']) {
      const q = `En un lugar de la Mancha ${mark} vivía un hidalgo de los de lanza`;
      expect(checkQuoteAgainstSource(q, SOURCE)).toEqual({ ok: true, segments: 2 });
    }
  });

  it('accepts the " … " separator produced by combining fragments', () => {
    expect(checkQuoteAgainstSource('rocín flaco y galgo corredor … salpicón las más noches', SOURCE).ok).toBe(true);
  });

  it('rejects omissions whose passages are out of source order', () => {
    expect(checkQuoteAgainstSource('salpicón las más noches […] En un lugar de la Mancha', SOURCE))
      .toEqual({ ok: false, reason: 'not_in_source' });
  });

  it('rejects overlapping passages', () => {
    expect(checkQuoteAgainstSource('un lugar de la […] de la Mancha de cuyo', SOURCE).ok).toBe(false);
  });

  it('rejects stitching single words together with omissions', () => {
    expect(checkQuoteAgainstSource('no […] quiero […] vaca', SOURCE)).toEqual({ ok: false, reason: 'segment_too_short' });
  });

  it('rejects more than the maximum number of passages', () => {
    const q = Array(7).fill('En un lugar de la Mancha').join(' […] ');
    expect(checkQuoteAgainstSource(q, SOURCE)).toEqual({ ok: false, reason: 'too_many_segments' });
  });

  it('rejects text with no words', () => {
    expect(checkQuoteAgainstSource(' … ¡! ', SOURCE)).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('QuoteIntegrityService', () => {
  const syncMapRepo = { findOneBy: jest.fn() };
  const storage = { getText: jest.fn() };
  const book = { id: 'b1', textFileKey: 'texts/b1.txt' } as Book;
  let service: QuoteIntegrityService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        QuoteIntegrityService,
        { provide: getRepositoryToken(SyncMap), useValue: syncMapRepo },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(QuoteIntegrityService);
  });

  it('verifies against the sync-map phrases when present', async () => {
    syncMapRepo.findOneBy.mockResolvedValue({ phrases: [{ text: 'Hello there,' }, { text: 'general Kenobi.' }] });
    await expect(service.assertFaithfulExcerpt(book, 'there, general Kenobi')).resolves.toBeUndefined();
    expect(storage.getText).not.toHaveBeenCalled();
  });

  it('falls back to the stored text file when there is no sync map', async () => {
    syncMapRepo.findOneBy.mockResolvedValue(null);
    storage.getText.mockResolvedValue('It was the best of times, it was the worst of times.');
    await expect(service.assertFaithfulExcerpt(book, 'the worst of times')).resolves.toBeUndefined();
    expect(storage.getText).toHaveBeenCalledWith('texts/b1.txt');
  });

  it('throws 422 quote_not_in_source with the reason for unfaithful text', async () => {
    syncMapRepo.findOneBy.mockResolvedValue({ phrases: [{ text: 'Hello there.' }] });
    await expect(service.assertFaithfulExcerpt(book, 'Goodbye there')).rejects.toMatchObject({
      constructor: UnprocessableEntityException,
      response: { error: 'quote_not_in_source', reason: 'not_in_source' },
    });
  });

  it('refuses (422 no_source) when the book has no text to verify against', async () => {
    syncMapRepo.findOneBy.mockResolvedValue(null);
    await expect(service.assertFaithfulExcerpt({ id: 'b2', textFileKey: null } as Book, 'anything'))
      .rejects.toMatchObject({ response: { error: 'quote_not_in_source', reason: 'no_source' } });
  });

  it('reports a storage outage as 503, not as an unfaithful quote', async () => {
    syncMapRepo.findOneBy.mockResolvedValue(null);
    storage.getText.mockRejectedValue(new Error('minio down'));
    await expect(service.assertFaithfulExcerpt(book, 'x')).rejects.toThrow(ServiceUnavailableException);
  });

  it('caches the normalized source per book', async () => {
    syncMapRepo.findOneBy.mockResolvedValue({ phrases: [{ text: 'one two three four' }] });
    await service.assertFaithfulExcerpt(book, 'two three');
    await service.assertFaithfulExcerpt(book, 'three four');
    expect(syncMapRepo.findOneBy).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest book when the cache is full', async () => {
    syncMapRepo.findOneBy.mockResolvedValue({ phrases: [{ text: 'alpha beta' }] });
    for (let i = 0; i < 9; i++) await service.assertFaithfulExcerpt({ id: `b${i}` } as Book, 'alpha');
    syncMapRepo.findOneBy.mockClear();
    await service.assertFaithfulExcerpt({ id: 'b0' } as Book, 'alpha'); // evicted → reloaded
    await service.assertFaithfulExcerpt({ id: 'b8' } as Book, 'alpha'); // still cached
    expect(syncMapRepo.findOneBy).toHaveBeenCalledTimes(1);
  });
});
