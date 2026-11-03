import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MAX_OMISSION_GAP_CHARS,
  MAX_OMISSION_SEGMENTS,
  OMISSION_BLOCKED_WORDS,
  OMISSION_MARKER,
  QuoteIntegrityService,
  canonicalizeOmissionMarkers,
  checkQuoteAgainstSource,
  normalizeTypography,
} from '../../../src/sharing/quote-integrity.service';
import { SyncMap } from '../../../src/books/sync-map.entity';
import { StorageService } from '../../../src/storage/storage.service';
import { Book } from '../../../src/books/book.entity';

const RAW =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo ' +
  'que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. ' +
  '¿Esperas… qué? Una olla de algo más vaca que carnero, salpicón las más noches, ' +
  'duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos.';
const SOURCE = normalizeTypography(RAW);
const check = (q: string) => checkQuoteAgainstSource(q, SOURCE);

describe('normalizeTypography', () => {
  it('folds quote styles, dashes, "..." and spacing but keeps words, punctuation and case', () => {
    expect(normalizeTypography('  «Él dijo — “¡No!”...»\n')).toBe('"Él dijo-"¡No!"…"');
  });

  it('removes soft hyphens and treats a lost space after punctuation as equal', () => {
    expect(normalizeTypography('astil\u00ADlero')).toBe('astillero');
    expect(normalizeTypography('corredor.Una')).toBe(normalizeTypography('corredor. Una'));
  });
});

describe('canonicalizeOmissionMarkers', () => {
  it('renders typed [...] and [ … ] as the approved [ … ] marker', () => {
    expect(canonicalizeOmissionMarkers('a [...] b [ … ] c')).toBe(`a ${OMISSION_MARKER} b ${OMISSION_MARKER} c`);
  });

  it.each(['[...]', '[....]', '[ ... ]', '[ … ]', '[…]', '[\u2026 ]'])('canonicalizes %p to the approved [ … ]', (m) => {
    expect(canonicalizeOmissionMarkers(`a ${m} b`)).toBe(`a ${OMISSION_MARKER} b`);
  });

  it('every marker form the validator accepts is canonicalized (input and display stay consistent)', () => {
    for (const m of ['[...]', '[....]', '[ ... ]', '[ … ]']) {
      const q = `rocín flaco y galgo corredor ${m} Una olla de algo más vaca`;
      expect(check(q).ok).toBe(true);
      expect(canonicalizeOmissionMarkers(q)).not.toMatch(/\.\.\./);
      expect(check(canonicalizeOmissionMarkers(q))).toEqual(check(q)); // same verdict and spans
    }
  });

  it('does not invent markers: (...) and bare ... are left as typed', () => {
    expect(canonicalizeOmissionMarkers('a (...) b ... c')).toBe('a (...) b ... c');
  });

  it('leaves bare ellipses alone (they are only valid where the author wrote them)', () => {
    expect(canonicalizeOmissionMarkers('¿Esperas… qué?')).toBe('¿Esperas… qué?');
  });
});

describe('checkQuoteAgainstSource — wording', () => {
  it('accepts an exact contiguous excerpt and returns its source span (traceability)', () => {
    const r = check('de cuyo nombre no quiero acordarme');
    expect(r).toEqual({ ok: true, spans: [{ start: expect.any(Number), end: expect.any(Number) }] });
    if (r.ok) expect(SOURCE.slice(r.spans[0].start, r.spans[0].end)).toBe('de cuyo nombre no quiero acordarme');
  });

  it('accepts wrapping quotation marks, a closing period and a capitalised first letter', () => {
    expect(check('«De cuyo nombre no quiero acordarme.»').ok).toBe(true);
    expect(check('"Rocín flaco y galgo corredor"').ok).toBe(true);
  });

  it('accepts edge truncation marks', () => {
    expect(check('… un hidalgo de los de lanza en astillero…').ok).toBe(true);
  });

  it('accepts an ellipsis the author wrote', () => {
    expect(check('¿Esperas… qué?').ok).toBe(true);
  });

  it('accepts curly vs straight quote and dash variants', () => {
    const src = normalizeTypography('Dijo: “ven” — y se fue.');
    expect(checkQuoteAgainstSource('Dijo: "ven" - y se fue.', src).ok).toBe(true);
  });

  it.each([
    ['changed word', 'de cuyo nombre sí quiero acordarme'],
    ['paraphrase', 'Vivía en la Mancha un hidalgo pobre'],
    ['added question mark', 'de cuyo nombre no quiero acordarme?'],
    ['added exclamation', 'rocín flaco y galgo corredor!'],
    ['removed comma inside the passage', 'adarga antigua rocín flaco'],
    ['changed capitalisation mid-passage', 'En un lugar de la mancha'],
    ['partial word at the start', 'ancha, de cuyo'],
    ['partial word at the end', 'de cuyo nomb'],
  ])('rejects %s', (_label, q) => {
    expect(check(q)).toEqual({ ok: false, reason: 'not_in_source' });
  });
});

describe('checkQuoteAgainstSource — omissions', () => {
  it('accepts [ … ] between verbatim passages in source order', () => {
    const r = check('rocín flaco y galgo corredor […] Una olla de algo más vaca');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spans).toHaveLength(2);
      expect(r.spans[0].end).toBeLessThan(r.spans[1].start);
    }
  });

  it('accepts typed [...] as the marker', () => {
    expect(check('rocín flaco y galgo corredor [...] Una olla de algo más vaca').ok).toBe(true);
  });

  it('a bare "…" is not an omission marker: asks for [ … ] when that would pass', () => {
    expect(check('rocín flaco y galgo corredor … Una olla de algo más vaca')).toEqual({ ok: false, reason: 'omission_marker_required' });
  });

  it('reports not_in_source for a bare "…" when marking it would still fail', () => {
    expect(check('Una olla de algo … rocín flaco y galgo')).toEqual({ ok: false, reason: 'not_in_source' });
  });

  it('rejects (…) — only square brackets mark an omission', () => {
    expect(check('rocín flaco y galgo corredor (…) Una olla de algo más vaca').ok).toBe(false);
  });

  it('rejects passages out of source order', () => {
    expect(check('Una olla de algo más vaca […] rocín flaco y galgo corredor')).toEqual({ ok: false, reason: 'not_in_source' });
  });

  it('rejects overlapping passages', () => {
    expect(check('un hidalgo de los […] de los de lanza en astillero').ok).toBe(false);
  });

  it('rejects stitching short passages together', () => {
    expect(check('En un lugar […] hidalgo […] los domingos')).toEqual({ ok: false, reason: 'segment_too_short' });
  });

  it('rejects more than the maximum number of passages', () => {
    expect(check(Array(MAX_OMISSION_SEGMENTS + 1).fill('rocín flaco y galgo').join(' […] '))).toEqual({ ok: false, reason: 'too_many_segments' });
  });

  it('rejects an omission that removes a negation (meaning safeguard)', () => {
    // "de cuyo nombre [no] quiero acordarme"
    expect(check('En un lugar de la Mancha, de cuyo nombre […] quiero acordarme, no ha')).toEqual({ ok: false, reason: 'omission_may_distort' });
  });

  it.each(['never', 'nunca', 'sin', 'excepto', "don't"])('treats "%s" in the omitted text as a negation/exception', (w) => {
    const src = normalizeTypography(`The reader opened the book and ${w} closed it again before dawn came.`);
    expect(checkQuoteAgainstSource('The reader opened the book […] closed it again before dawn', src)).toEqual({ ok: false, reason: 'omission_may_distort' });
  });

  it('rejects an omission spanning too much source text', () => {
    const filler = 'palabra '.repeat(Math.ceil(MAX_OMISSION_GAP_CHARS / 8) + 5);
    const src = normalizeTypography(`Primera frase muy clara aquí. ${filler} Última frase muy clara también.`);
    expect(checkQuoteAgainstSource('Primera frase muy clara […] Última frase muy clara', src)).toEqual({ ok: false, reason: 'omission_too_long' });
  });

  it('chooses a later occurrence when the first one would omit a negation', () => {
    const src = normalizeTypography('el lector abrió el libro. No lo cerró. Al día siguiente el lector abrió el libro y lo cerró de golpe.');
    expect(checkQuoteAgainstSource('el lector abrió el libro […] lo cerró de golpe', src).ok).toBe(true);
  });

  it('rejects text with no words', () => {
    expect(check(' … ¡! [ … ] ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('blocks the expected ES/EN negation and exception words', () => {
    for (const w of ['not', 'no', 'never', 'without', 'except', 'unless', 'nunca', 'jamás', 'ni', 'sin', 'excepto', 'salvo']) {
      expect(OMISSION_BLOCKED_WORDS.has(w)).toBe(true);
    }
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
    const prov = await service.assertFaithfulExcerpt(book, 'there, general Kenobi');
    expect(prov).toMatchObject({ v: 1, source: 'sync_map', sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(prov.spans).toHaveLength(1);
    expect(storage.getText).not.toHaveBeenCalled();
  });

  it('falls back to the stored text file when there is no sync map', async () => {
    syncMapRepo.findOneBy.mockResolvedValue(null);
    storage.getText.mockResolvedValue('It was the best of times, it was the worst of times.');
    await expect(service.assertFaithfulExcerpt(book, 'the worst of times')).resolves.toMatchObject({ source: 'text_file' });
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
