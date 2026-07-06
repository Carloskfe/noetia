import { Test, TestingModule } from '@nestjs/testing';
import { GutenbergFetcherService } from '../../../src/ingestion/gutenberg-fetcher.service';

const mockFetch = jest.fn();

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('GutenbergFetcherService', () => {
  let service: GutenbergFetcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GutenbergFetcherService],
    }).compile();

    service = module.get<GutenbergFetcherService>(GutenbergFetcherService);
  });

  describe('fetch', () => {
    it('fetches the correct Gutenberg URL and returns stripped text', async () => {
      const raw =
        'Some preamble\n' +
        '*** START OF THE PROJECT GUTENBERG EBOOK FOO ***\n' +
        'Chapter 1. The beginning.\n' +
        '*** END OF THE PROJECT GUTENBERG EBOOK FOO ***\n' +
        'Some postamble';
      mockFetch.mockResolvedValue({ ok: true, text: async () => raw });

      const result = await service.fetch(320);

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://www.gutenberg.org/cache/epub/320/pg320.txt',
      );
      expect(result).toBe('Chapter 1. The beginning.');
    });

    it('strips THIS PROJECT GUTENBERG variant header', async () => {
      const raw =
        '*** START OF THIS PROJECT GUTENBERG EBOOK BAR ***\n' +
        'Content here.\n' +
        '*** END OF THIS PROJECT GUTENBERG EBOOK BAR ***';
      mockFetch.mockResolvedValue({ ok: true, text: async () => raw });

      const result = await service.fetch(100);

      expect(result).toBe('Content here.');
    });

    it('returns the full text when no Gutenberg markers are found', async () => {
      const raw = 'Plain text without markers.';
      mockFetch.mockResolvedValue({ ok: true, text: async () => raw });

      const result = await service.fetch(999);

      expect(result).toBe('Plain text without markers.');
    });

    it('throws when response is not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(service.fetch(0)).rejects.toThrow('HTTP 404');
    });

    it('propagates network errors', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      await expect(service.fetch(320)).rejects.toThrow('network error');
    });

    it('falls back to the canonical .txt.utf-8 endpoint when cache/epub fails', async () => {
      const raw =
        '*** START OF THE PROJECT GUTENBERG EBOOK FOO ***\n' +
        'UTF-8 body.\n' +
        '*** END OF THE PROJECT GUTENBERG EBOOK FOO ***';
      const timeout = Object.assign(new Error('aborted'), { cause: { code: 'ETIMEDOUT' } });
      mockFetch
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce({ ok: true, text: async () => raw });

      const result = await service.fetch(39209);

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://www.gutenberg.org/cache/epub/39209/pg39209.txt',
      );
      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://www.gutenberg.org/ebooks/39209.txt.utf-8',
      );
      expect(result).toBe('UTF-8 body.');
    });

    it('falls back to the pglaf mirror when both gutenberg.org sources fail', async () => {
      const raw =
        '*** START OF THE PROJECT GUTENBERG EBOOK FOO ***\n' +
        'Mirror body.\n' +
        '*** END OF THE PROJECT GUTENBERG EBOOK FOO ***';
      const timeout = Object.assign(new Error('aborted'), { cause: { code: 'ETIMEDOUT' } });
      mockFetch
        .mockRejectedValueOnce(timeout)
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce({ ok: true, text: async () => raw });

      const result = await service.fetch(2000);

      expect(mockFetch.mock.calls[2][0]).toBe(
        'https://gutenberg.pglaf.org/2/0/0/2000/2000-0.txt',
      );
      expect(result).toBe('Mirror body.');
    });

    it('tries every source before giving up', async () => {
      const timeout = Object.assign(new Error('boom'), { cause: { code: 'ETIMEDOUT' } });
      mockFetch.mockRejectedValue(timeout);

      await expect(service.fetch(2000)).rejects.toThrow('boom');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('passes an abort signal so a hung host fails fast', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => 'Plain.' });

      await service.fetch(1232);

      expect(mockFetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    it('strips preamble when narrativeStartPattern is provided', async () => {
      const raw =
        '*** START OF THE PROJECT GUTENBERG EBOOK FOO ***\n' +
        'PREAMBLE INTRODUCTION\nMore preamble text here.\n' +
        'CANTO PRIMERO\n' +
        'Háblame, Musa, de aquel varón.\n' +
        '*** END OF THE PROJECT GUTENBERG EBOOK FOO ***';
      mockFetch.mockResolvedValue({ ok: true, text: async () => raw });

      const result = await service.fetch(58221, 'CANTO PRIMERO');

      expect(result).toContain('CANTO PRIMERO');
      expect(result).toContain('Háblame, Musa');
      expect(result).not.toContain('PREAMBLE INTRODUCTION');
    });

    it('strips appendix when narrativeEndPattern is provided', async () => {
      const raw =
        '*** START OF THE PROJECT GUTENBERG EBOOK FOO ***\n' +
        'CANTO XXIV\nFinal canto text.\n' +
        '\nFIN\n' +
        'ÍNDICE DE NOMBRES PROPIOS\nACASTO. En Ítaca.\n' +
        '*** END OF THE PROJECT GUTENBERG EBOOK FOO ***';
      mockFetch.mockResolvedValue({ ok: true, text: async () => raw });

      const result = await service.fetch(58221, undefined, '\nFIN\n');

      expect(result).toContain('FIN');
      expect(result).not.toContain('ÍNDICE DE NOMBRES PROPIOS');
      expect(result).not.toContain('ACASTO');
    });

    it('applies both start and end patterns together', async () => {
      const raw =
        '*** START OF THE PROJECT GUTENBERG EBOOK ODISEA ***\n' +
        'AL LECTOR\nIntroducción muy larga...\n' +
        'CANTO PRIMERO\nHáblame, Musa.\n' +
        '\nFIN\n' +
        'GLOSARIO\nAcasto...\n' +
        '*** END OF THE PROJECT GUTENBERG EBOOK ODISEA ***';
      mockFetch.mockResolvedValue({ ok: true, text: async () => raw });

      const result = await service.fetch(58221, 'CANTO PRIMERO', '\nFIN\n');

      expect(result).toContain('CANTO PRIMERO');
      expect(result).toContain('Háblame, Musa.');
      expect(result).toContain('FIN');
      expect(result).not.toContain('AL LECTOR');
      expect(result).not.toContain('GLOSARIO');
    });
  });
});
