import { CATALOGUE, CatalogueEntry } from '../../../src/ingestion/catalogue';

// ── Don Quijote Part I / Part II split ──────────────────────────────────────────
//
// Both volumes share Gutenberg 2000 (the COMPLETE Don Quijote, Parts I + II in one
// file). Each volume's `textPostProcess` carves out only its own part so it aligns
// 1:1 with its audiobook. The tricky bit: the Part II heading
// ("...ingenioso caballero...") also appears in the file's table of contents near
// the top, so a naive indexOf would cut Vol I to nothing — the real boundary is
// found by searching past the front matter (offset 50,000).

const find = (title: string): CatalogueEntry => {
  const e = CATALOGUE.find((c) => c.title === title);
  if (!e) throw new Error(`catalogue entry not found: ${title}`);
  return e;
};

// Synthetic text reproducing the real pg2000.txt structure: a TOC copy of the
// Part II heading near the top, then the Part I "TASA" legal front matter (which the
// recording reads, so Vol I must include it), the real Part I heading, the Part I
// body, the real Part II heading well past offset 50,000, the unread Part II legal
// front matter, and finally the 1615 prologue + Part II body.
function buildCombinedText(): string {
  const PART2_HEADING = 'Segunda parte del ingenioso caballero don Quijote de la Mancha';
  const toc = `CONTENIDO\n${PART2_HEADING}\nTasa\nFee de erratas\nAprobaciones\n\n`;
  const filler = 'relleno preliminar del libro '.repeat(2500); // pushes the real boundary past 50,000
  const part1FrontMatter =
    'TASA\nYo, Juan Gallo de Andrada, FRONT_MATTER_LEIDA por el narrador.\n' +
    'Testimonio de las erratas. El Rey. Prólogo. Versos preliminares.\n\n';
  const part1 =
    part1FrontMatter +
    'Primera parte del ingenioso hidalgo don Quijote de la Mancha\n\n' +
    'Capítulo primero.\nEN_UN_LUGAR_DE_LA_MANCHA — cuerpo de la primera parte.\n';
  const endOfPart1 = '...canterà con miglior plectio.\n\nFinis\n\n\n';
  const part2FrontMatter = `${PART2_HEADING}\n\nTASA\nYo, Hernando de Vallejo, MATERIA_LEGAL no leída.\n\n`;
  const part2 =
    'PRÓLOGO AL LECTOR\n\n' +
    '¡Válame Dios, y con cuánta gana debes de estar esperando ahora, lector ilustre!\n' +
    'CUERPO_DE_LA_SEGUNDA_PARTE — aquí.\n';
  return toc + filler + part1 + endOfPart1 + part2FrontMatter + part2;
}

describe('Don Quijote catalogue entries', () => {
  const volI = find('Don Quijote de la Mancha — Vol. I');
  const volII = find('Don Quijote de la Mancha — Vol. II');
  const combined = buildCombinedText();

  it('both volumes share Gutenberg 2000 and define a textPostProcess split', () => {
    expect(volI.gutenbergId).toBe(2000);
    expect(volII.gutenbergId).toBe(2000);
    expect(typeof volI.textPostProcess).toBe('function');
    expect(typeof volII.textPostProcess).toBe('function');
  });

  describe('Vol. I = Part I, including the Tasa front matter the recording reads', () => {
    const out = volI.textPostProcess!(combined);

    it('begins at the TASA front matter, not the "Primera parte" heading', () => {
      expect(out.startsWith('TASA')).toBe(true);
    });
    it('includes the legal front matter the narrator reads (proves it is no longer dropped)', () => {
      expect(out).toContain('FRONT_MATTER_LEIDA');
    });
    it('still contains the Part I structural heading and body', () => {
      expect(out).toContain('Primera parte del ingenioso hidalgo don Quijote de la Mancha');
      expect(out).toContain('EN_UN_LUGAR_DE_LA_MANCHA');
    });
    it('excludes Part II content and its heading', () => {
      expect(out).not.toContain('CUERPO_DE_LA_SEGUNDA_PARTE');
      expect(out).not.toContain('ingenioso caballero');
    });
    it('excludes the unread title page + TOC before the Tasa', () => {
      expect(out).not.toContain('relleno preliminar');
      expect(out).not.toContain('CONTENIDO');
    });
  });

  describe('Vol. II = Part II only, starting at the 1615 prologue', () => {
    const out = volII.textPostProcess!(combined);

    it('begins at the 1615 prologue, skipping the unread legal front matter', () => {
      expect(out.startsWith('¡Válame Dios')).toBe(true);
      expect(out).not.toContain('MATERIA_LEGAL');
      expect(out).not.toContain('TASA');
    });
    it('keeps the Part II body', () => {
      expect(out).toContain('CUERPO_DE_LA_SEGUNDA_PARTE');
    });
    it('excludes Part I content and the structural heading', () => {
      expect(out).not.toContain('EN_UN_LUGAR_DE_LA_MANCHA');
      expect(out).not.toContain('ingenioso caballero');
    });
  });

  it('the two halves together cover the body without overlap', () => {
    const a = volI.textPostProcess!(combined);
    const b = volII.textPostProcess!(combined);
    // Part I body lives only in Vol I, Part II body only in Vol II.
    expect(a.includes('EN_UN_LUGAR_DE_LA_MANCHA') && !b.includes('EN_UN_LUGAR_DE_LA_MANCHA')).toBe(true);
    expect(b.includes('CUERPO_DE_LA_SEGUNDA_PARTE') && !a.includes('CUERPO_DE_LA_SEGUNDA_PARTE')).toBe(true);
  });

  it('falls back gracefully when the prologue marker is absent (Vol II)', () => {
    const noPrologue =
      'x'.repeat(60000) +
      'Segunda parte del ingenioso caballero don Quijote de la Mancha\n\nCUERPO sin prologo.\n';
    const out = volII.textPostProcess!(noPrologue);
    // No "Válame Dios" → keep from the heading rather than dropping everything.
    expect(out).toContain('CUERPO sin prologo');
  });
});

// ── English self-development first wave (added 2026-06-30) ───────────────────
describe('English self-development first-wave entries', () => {
  const firstWave: Array<[string, number]> = [
    ['As a Man Thinketh', 4507],
    ['The Art of War', 132],
    ['The Science of Getting Rich', 59844],
    ['The Game of Life and How to Play It', 74878],
    ['How to Live on 24 Hours a Day', 2274],
    ['Up from Slavery', 2376],
  ];

  it.each(firstWave)('%s is a Gutenberg #%i English entry with a LibriVox URL', (title, id) => {
    const e = CATALOGUE.find((c) => c.title === title);
    expect(e).toBeDefined();
    expect(e!.source).toBe('gutenberg');
    expect(e!.gutenbergId).toBe(id);
    expect(e!.language).toBe('en');
    expect(e!.librivoxAudioUrl).toMatch(/^https:\/\/librivox\.org\//);
  });

  it.each(firstWave)('%s appears exactly once in the catalogue', (title) => {
    expect(CATALOGUE.filter((c) => c.title === title)).toHaveLength(1);
  });
});
