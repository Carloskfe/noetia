import { Test, TestingModule } from '@nestjs/testing';
import { WikisourceFetcherService, romanToInt } from '../../../src/ingestion/wikisource-fetcher.service';

const mockFetch = jest.fn();

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  jest.resetAllMocks();
});

const LINKS_RESPONSE = (title: string, subs: string[]) => ({
  ok: true,
  json: async () => ({
    parse: { links: subs.map((s) => ({ title: s, ns: 0 })) },
  }),
});

const HTML_RESPONSE = (html: string) => ({
  ok: true,
  json: async () => ({ parse: { text: html } }),
});

describe('romanToInt', () => {
  it('converts simple numerals', () => {
    expect(romanToInt('I')).toBe(1);
    expect(romanToInt('II')).toBe(2);
    expect(romanToInt('III')).toBe(3);
  });

  it('converts subtractive-notation numerals (IV, IX, XL, XC)', () => {
    expect(romanToInt('IV')).toBe(4);
    expect(romanToInt('IX')).toBe(9);
    expect(romanToInt('XL')).toBe(40);
    expect(romanToInt('XC')).toBe(90);
  });

  it('converts the V+I additive range (VI, VII, VIII) — regression for the malformed-regex bug', () => {
    expect(romanToInt('VI')).toBe(6);
    expect(romanToInt('VII')).toBe(7);
    expect(romanToInt('VIII')).toBe(8);
  });

  it('converts larger numerals (XIV, XIX, XXXIV)', () => {
    expect(romanToInt('XIV')).toBe(14);
    expect(romanToInt('XIX')).toBe(19);
    expect(romanToInt('XXXIV')).toBe(34);
  });

  it('is case-insensitive', () => {
    expect(romanToInt('xiv')).toBe(14);
  });

  it('returns null for non-Roman-numeral strings', () => {
    expect(romanToInt('CAPÍTULO')).toBeNull();
    expect(romanToInt('')).toBeNull();
    expect(romanToInt('ABC')).toBeNull();
  });

  it('returns null for invalid Roman numeral notation (repeated subtractive forms)', () => {
    expect(romanToInt('IIII')).toBeNull();
    expect(romanToInt('VV')).toBeNull();
  });
});

describe('WikisourceFetcherService', () => {
  let service: WikisourceFetcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WikisourceFetcherService],
    }).compile();

    service = module.get<WikisourceFetcherService>(WikisourceFetcherService);
  });

  describe('fetch — single-page book (no subpages)', () => {
    it('returns text from the single page when no subpages exist', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Romeo y Julieta', []))
        .mockResolvedValueOnce(HTML_RESPONSE('<p>Acto I. Escena primera.</p>'));

      const result = await service.fetch('Romeo y Julieta');

      expect(result).toBe('Acto I. Escena primera.');
    });

    it('strips headertemplate navigation div from chapter HTML', async () => {
      const html =
        '<div id="headertemplate" class="noprint ws-noexport">' +
        '<div class="main-div">España 100 p.m.a. o menos artículo enciclopédico</div>' +
        '</div>' +
        '<p>Comenzaba este largo siglo que ya va de vencida.</p>';
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('El sombrero de tres picos (1874)', []))
        .mockResolvedValueOnce(HTML_RESPONSE(html));

      const result = await service.fetch('El sombrero de tres picos (1874)');

      expect(result).toContain('Comenzaba este largo siglo');
      expect(result).not.toContain('100 p.m.a. o menos');
      expect(result).not.toContain('artículo enciclopédico');
    });

    it('strips ws-data metadata div from chapter HTML', async () => {
      const html =
        '<div id="ws-data" class="ws-noexport" style="display:none">' +
        '<span class="ws-title">La isla del tesoro</span>' +
        '</div>' +
        '<p>Imposible me ha sido rehusarme a las repetidas instancias.</p>';
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('La isla del tesoro (Manuel Caballero)', []))
        .mockResolvedValueOnce(HTML_RESPONSE(html));

      const result = await service.fetch('La isla del tesoro (Manuel Caballero)');

      expect(result).toContain('Imposible me ha sido rehusarme');
      expect(result).not.toContain('ws-title');
      expect(result).not.toContain('La isla del tesoro');
    });

    it('strips KJV wst-marginnote spans (marginal notes + chronology headers) and stray ‖ markers', async () => {
      // Both the "‖ Some read…" marginal notes and the running chronology headers
      // are wrapped in a <span class="wst-marginnote"> with a nested inner span;
      // neither is narrated, so both must be removed (balanced, handling nesting).
      const html =
        '<p>11 And ‖<span class="wst-marginnote" style="float:right">' +
        '<span style="font-size:smaller">‖ Some read, Josias begat Jakim.</span></span>' +
        ' Josias begat Jechonias and his brethren.</p>' +
        '<p><span class="wst-marginnote" style="float:right">' +
        '<span>The Fifth Year before the Common Account called Anno Dom.</span></span>' +
        '12 Now the birth of Jesus Christ was on this wise.</p>';
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Bible (King James)/Matthew', []))
        .mockResolvedValueOnce(HTML_RESPONSE(html));

      const result = await service.fetch('Bible (King James)/Matthew', 'en');

      expect(result).toContain('Josias begat Jechonias and his brethren.');
      expect(result).toContain('Now the birth of Jesus Christ was on this wise.');
      expect(result).not.toContain('Some read');
      expect(result).not.toContain('before the Common Account');
      expect(result).not.toContain('‖');
    });

    it('strips HTML tags and decodes entities', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('TestPage', []))
        .mockResolvedValueOnce(
          HTML_RESPONSE('<p>Él dijo &quot;hola&quot; &amp; adiós.</p>'),
        );

      const result = await service.fetch('TestPage');

      expect(result).toBe('Él dijo "hola" & adiós.');
    });

    it('throws when the page request is not ok', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Page', []))
        .mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(service.fetch('Page')).rejects.toThrow('HTTP 404');
    });

    it('throws when the API returns an error field', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Page', []))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: { info: 'Page not found' } }),
        });

      await expect(service.fetch('Page')).rejects.toThrow('Page not found');
    });

    it('throws when parse.text is absent', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Page', []))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ parse: {} }) });

      await expect(service.fetch('Page')).rejects.toThrow('No text returned');
    });
  });

  describe('fetch — multi-page book (subpages)', () => {
    const TITLE = 'Viaje al centro de la Tierra';

    it('fetches each subpage and concatenates the text', async () => {
      const ch1 = '<p>' + 'Capítulo I. '.repeat(12) + '</p>';
      const ch2 = '<p>' + 'Capítulo II. '.repeat(12) + '</p>';
      mockFetch
        .mockResolvedValueOnce(
          LINKS_RESPONSE(TITLE, [`${TITLE}/I`, `${TITLE}/II`]),
        )
        .mockResolvedValueOnce(HTML_RESPONSE(ch1))
        .mockResolvedValueOnce(HTML_RESPONSE(ch2));

      const result = await service.fetch(TITLE);

      expect(result).toContain('Capítulo I.');
      expect(result).toContain('Capítulo II');  // II appears in both II. and II repeated text
    });

    it('sorts Roman-numeral subpages before fetching so chapters arrive in order', async () => {
      const fetchOrder: string[] = [];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, [`${TITLE}/III`, `${TITLE}/I`, `${TITLE}/II`]);
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>Lorem ipsum dolor sit amet consectetuer.</p>');
      });

      await service.fetch(TITLE);

      // URLs are percent-encoded so '/' becomes '%2F'
      expect(fetchOrder[0]).toContain('%2FI&');
      expect(fetchOrder[1]).toContain('%2FII&');
      expect(fetchOrder[2]).toContain('%2FIII&');
    });

    // Regression test: I, II, III sort correctly even alphabetically, which
    // let a real bug ship undetected for the IV/V/IX divergence range
    // (plain string sort puts "IX" before "V"). La Isla del Tesoro's 34
    // chapters were silently scrambled by this. Limited to IV-X (not the
    // full I-XX range) to keep real-elapsed sleep() time well under Jest's
    // default test timeout — each subpage fetch sleeps 400ms.
    it('sorts Roman-numeral subpages IV through X in true numeric order, not alphabetical', async () => {
      const fetchOrder: string[] = [];
      const shuffled = ['IX', 'IV', 'X', 'V', 'VI', 'VII', 'VIII'];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, shuffled.map((n) => `${TITLE}/${n}`));
        }
        fetchOrder.push(url as string);
        // Must exceed fetch()'s 100-char "near-empty" threshold, or every
        // subpage gets discarded and it falls back to re-fetching the bare
        // title page once — adding a spurious 8th URL to fetchOrder.
        return HTML_RESPONSE('<p>' + 'Lorem ipsum dolor sit amet consectetuer. '.repeat(5) + '</p>');
      });

      await service.fetch(TITLE);

      const expected = ['IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      const actual = fetchOrder.map((url) => decodeURIComponent(url).split('/').pop()?.split('&')[0]);
      expect(actual).toEqual(expected);
    }, 10000);

    // El Sombrero de Tres Picos and Orgullo y Prejuicio name their subpages
    // "Capítulo I", "Capítulo IX", etc. — a prefix plus a Roman numeral, not
    // a bare numeral. Confirms the prefix-matching logic (shared with the
    // Arabic-digit case) also applies to the Roman-numeral path.
    it('sorts "Capítulo <Roman numeral>" subpages numerically (Capítulo IX after Capítulo VIII, not before Capítulo V)', async () => {
      const fetchOrder: string[] = [];
      const shuffled = ['Capítulo IX', 'Capítulo IV', 'Capítulo X', 'Capítulo V', 'Capítulo VI', 'Capítulo VII', 'Capítulo VIII'];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, shuffled.map((n) => `${TITLE}/${n}`));
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>' + 'Lorem ipsum dolor sit amet consectetuer. '.repeat(5) + '</p>');
      });

      await service.fetch(TITLE);

      const expected = ['Capítulo IV', 'Capítulo V', 'Capítulo VI', 'Capítulo VII', 'Capítulo VIII', 'Capítulo IX', 'Capítulo X'];
      const actual = fetchOrder.map((url) => decodeURIComponent(url).split('/').pop()?.split('&')[0]);
      expect(actual).toEqual(expected);
    }, 10000);

    // Lazarillo de Tormes names its subpages with spelled-out Spanish
    // ordinals ("Tratado primero", "Tratado segundo"...), not numerals at
    // all — confirmed via the live Wikisource API. Plain alphabetical sort
    // scrambles these completely (cuarto before primero, etc.).
    it('sorts "Tratado <ordinal word>" subpages by ordinal value, not alphabetically', async () => {
      const fetchOrder: string[] = [];
      const shuffled = ['Tratado cuarto', 'Tratado primero', 'Tratado quinto', 'Tratado segundo', 'Tratado sexto', 'Tratado séptimo', 'Tratado tercero'];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, shuffled.map((n) => `${TITLE}/${n}`));
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>' + 'Lorem ipsum dolor sit amet consectetuer. '.repeat(5) + '</p>');
      });

      await service.fetch(TITLE);

      const expected = ['Tratado primero', 'Tratado segundo', 'Tratado tercero', 'Tratado cuarto', 'Tratado quinto', 'Tratado sexto', 'Tratado séptimo'];
      const actual = fetchOrder.map((url) => decodeURIComponent(url).split('/').pop()?.split('&')[0]);
      expect(actual).toEqual(expected);
    }, 10000);

    // El Sombrero de Tres Picos has a "Prefacio" subpage alongside 36
    // numbered chapters. "Prefacio" matches no numeral pattern, so plain
    // sort falls through to alphabetical — "P" sorts after "C", appending
    // the preface at the very END of the book instead of the very start.
    // Confirmed via the live Wikisource API.
    it('sorts an un-numbered "Prefacio" subpage to the front, not alphabetically to the back', async () => {
      const fetchOrder: string[] = [];
      const shuffled = ['Capítulo III', 'Capítulo I', 'Prefacio', 'Capítulo II'];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, shuffled.map((n) => `${TITLE}/${n}`));
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>' + 'Lorem ipsum dolor sit amet consectetuer. '.repeat(5) + '</p>');
      });

      await service.fetch(TITLE);

      const expected = ['Prefacio', 'Capítulo I', 'Capítulo II', 'Capítulo III'];
      const actual = fetchOrder.map((url) => decodeURIComponent(url).split('/').pop()?.split('&')[0]);
      expect(actual).toEqual(expected);
    }, 10000);

    it('sorts an un-numbered back-matter subpage ("Índice") to the end', async () => {
      const fetchOrder: string[] = [];
      const shuffled = ['Índice', 'Capítulo II', 'Capítulo I'];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, shuffled.map((n) => `${TITLE}/${n}`));
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>' + 'Lorem ipsum dolor sit amet consectetuer. '.repeat(5) + '</p>');
      });

      await service.fetch(TITLE);

      const expected = ['Capítulo I', 'Capítulo II', 'Índice'];
      const actual = fetchOrder.map((url) => decodeURIComponent(url).split('/').pop()?.split('&')[0]);
      expect(actual).toEqual(expected);
    }, 10000);

    it('sorts numeric subpages in numeric order (1, 2, 10 not 1, 10, 2)', async () => {
      const fetchOrder: string[] = [];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, [`${TITLE}/10`, `${TITLE}/2`, `${TITLE}/1`]);
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>' + 'A'.repeat(200) + '.</p>');
      });

      await service.fetch(TITLE);

      expect(fetchOrder[0]).toContain('%2F1&');
      expect(fetchOrder[1]).toContain('%2F2&');
      expect(fetchOrder[2]).toContain('%2F10&');
    });

    it('sorts "Capítulo N" subpages numerically (Capítulo 2 before Capítulo 10)', async () => {
      const fetchOrder: string[] = [];
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('prop=links')) {
          return LINKS_RESPONSE(TITLE, [
            `${TITLE}/Cap%C3%ADtulo 10`,
            `${TITLE}/Cap%C3%ADtulo 2`,
            `${TITLE}/Cap%C3%ADtulo 1`,
          ]);
        }
        fetchOrder.push(url as string);
        return HTML_RESPONSE('<p>' + 'B'.repeat(200) + '.</p>');
      });

      await service.fetch(TITLE);

      expect(fetchOrder[0]).toContain('1');
      expect(fetchOrder[2]).toContain('10');
    });

    it('skips subpages with near-empty text without failing', async () => {
      mockFetch
        .mockResolvedValueOnce(
          LINKS_RESPONSE(TITLE, [`${TITLE}/I`, `${TITLE}/II`]),
        )
        .mockResolvedValueOnce(HTML_RESPONSE('<p>ok</p>')) // too short — skipped
        .mockResolvedValueOnce(
          HTML_RESPONSE('<p>' + 'A'.repeat(200) + '.</p>'),
        );

      const result = await service.fetch(TITLE);

      expect(result).not.toContain('ok');
      expect(result.length).toBeGreaterThan(100);
    });

    it('falls back to the main page if all subpage fetches fail', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE(TITLE, [`${TITLE}/I`]))
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce(HTML_RESPONSE('<p>Fallback main page text here.</p>'));

      const result = await service.fetch(TITLE);

      expect(result).toBe('Fallback main page text here.');
    });

    it('only uses links that are direct subpages of the requested title', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            parse: {
              links: [
                { title: `${TITLE}/I`, ns: 0 },
                { title: 'Otro Libro/I', ns: 0 },    // different book — excluded
                { title: `${TITLE}`, ns: 0 },         // root page — excluded
              ],
            },
          }),
        })
        .mockResolvedValueOnce(
          HTML_RESPONSE('<p>' + 'B'.repeat(200) + '.</p>'),
        );

      await service.fetch(TITLE);

      // Only one subpage fetch should have happened (the /I one)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetch — links API failure', () => {
    it('falls back to single-page fetch when the links API call fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 }) // links call fails
        .mockResolvedValueOnce(HTML_RESPONSE('<p>Direct page text here.</p>'));

      const result = await service.fetch('SomePage');

      expect(result).toBe('Direct page text here.');
    });
  });

  describe('fetchMultiple', () => {
    it('concatenates pages with ##HEADING## prefix using the last path segment', async () => {
      mockFetch
        .mockResolvedValueOnce(HTML_RESPONSE('<p>El texto del renacuajo paseador aquí.</p>'))
        .mockResolvedValueOnce(HTML_RESPONSE('<p>El texto de Simón el Bobito aquí.</p>'));

      const result = await service.fetchMultiple([
        'Rafael Pombo/El Renacuajo Paseador',
        'Rafael Pombo/Simón el Bobito',
      ]);

      expect(result).toContain('##HEADING## El Renacuajo Paseador');
      expect(result).toContain('##HEADING## Simón el Bobito');
      expect(result).toContain('El texto del renacuajo paseador aquí.');
      expect(result).toContain('El texto de Simón el Bobito aquí.');
    });

    it('uses the full title as heading when there is no slash', async () => {
      mockFetch.mockResolvedValueOnce(HTML_RESPONSE('<p>Texto del poema sin ruta.</p>'));

      const result = await service.fetchMultiple(['El Renacuajo Paseador']);

      expect(result).toContain('##HEADING## El Renacuajo Paseador');
    });

    it('skips pages with near-empty text', async () => {
      mockFetch
        .mockResolvedValueOnce(HTML_RESPONSE('<p>ok</p>'))  // too short — skipped
        .mockResolvedValueOnce(HTML_RESPONSE('<p>El texto largo de este poema va aquí.</p>'));

      const result = await service.fetchMultiple(['Titulo/Corto', 'Titulo/Largo']);

      expect(result).not.toContain('##HEADING## Corto');
      expect(result).toContain('##HEADING## Largo');
    });

    it('skips pages that throw without failing the whole batch', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce(HTML_RESPONSE('<p>Texto de la segunda página del poema.</p>'));

      const result = await service.fetchMultiple(['Pagina/Uno', 'Pagina/Dos']);

      expect(result).not.toContain('##HEADING## Uno');
      expect(result).toContain('##HEADING## Dos');
    });

    it('throws when none of the pages can be fetched', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(service.fetchMultiple(['Pagina/Uno', 'Pagina/Dos'])).rejects.toThrow(
        'None of the provided pages could be fetched',
      );
    });
  });

  describe('lang parameter — English Wikisource', () => {
    it('fetch() uses en.wikisource.org when lang="en"', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Bible (King James)/Genesis', []))
        .mockResolvedValueOnce(HTML_RESPONSE('<p>In the beginning God created the heaven and the earth.</p>'));

      const result = await service.fetch('Bible (King James)/Genesis', 'en');

      expect(result).toContain('In the beginning God created');
      const [linksCall, pageCall] = mockFetch.mock.calls;
      expect(linksCall[0]).toContain('en.wikisource.org');
      expect(pageCall[0]).toContain('en.wikisource.org');
    });

    it('fetch() defaults to es.wikisource.org when lang is omitted', async () => {
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE('Biblia Reina-Valera 1909/Génesis', []))
        .mockResolvedValueOnce(HTML_RESPONSE('<p>En el principio creó Dios los cielos y la tierra.</p>'));

      await service.fetch('Biblia Reina-Valera 1909/Génesis');

      const [linksCall] = mockFetch.mock.calls;
      expect(linksCall[0]).toContain('es.wikisource.org');
    });

    it('fetchMultiple() uses en.wikisource.org when lang="en"', async () => {
      mockFetch
        .mockResolvedValueOnce(HTML_RESPONSE('<p>Blessed is the man that walketh not in the counsel of the ungodly.</p>'))
        .mockResolvedValueOnce(HTML_RESPONSE('<p>The heavens declare the glory of God.</p>'));

      const result = await service.fetchMultiple(['Bible (King James)/Psalm 1', 'Bible (King James)/Psalm 19'], 'en');

      expect(result).toContain('Blessed is the man');
      expect(result).toContain('heavens declare');
      const [call1, call2] = mockFetch.mock.calls;
      expect(call1[0]).toContain('en.wikisource.org');
      expect(call2[0]).toContain('en.wikisource.org');
    });

    it('fetch() with subpages uses en.wikisource.org for all subpage requests', async () => {
      const TITLE = 'Bible (King James)/Matthew';
      // Text must be > 100 chars to avoid triggering the fallback fetch
      const ch1 = '<p>' + 'The book of the generation of Jesus Christ. '.repeat(4) + '</p>';
      const ch2 = '<p>' + 'Now when Jesus was born in Bethlehem of Judaea. '.repeat(4) + '</p>';
      mockFetch
        .mockResolvedValueOnce(LINKS_RESPONSE(TITLE, [`${TITLE}/1`, `${TITLE}/2`]))
        .mockResolvedValueOnce(HTML_RESPONSE(ch1))
        .mockResolvedValueOnce(HTML_RESPONSE(ch2));

      await service.fetch(TITLE, 'en');

      for (const [url] of mockFetch.mock.calls) {
        expect(url).toContain('en.wikisource.org');
      }
    });
  });
});
