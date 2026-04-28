import { Test, TestingModule } from '@nestjs/testing';
import { LibrivoxApiService } from '../../../src/ingestion/librivox-api.service';

const mockFetch = jest.fn();

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

const PAGE_URL = 'https://librivox.org/lazarillo-de-tormes/';
const ZIP_HREF = 'https://archive.org/compress/lazarillo_es_librivox/formats=64KBPS MP3&file=/lazarillo_es_librivox.zip';
const ZIP_URL_ENCODED = 'https://archive.org/compress/lazarillo_es_librivox/formats=64KBPS%20MP3&file=/lazarillo_es_librivox.zip';
const M4B_URL = 'https://archive.org/download/lazarillo_0912_librivox/LazarilloDeTormes_librivox.m4b';

const PAGE_WITH_ZIP = `<html><body>
  <a href="${ZIP_HREF}" class="book-download-btn">Download</a>
</body></html>`;

const PAGE_WITH_M4B = `<html><body>
  <a href="${M4B_URL}">M4B audio book</a>
</body></html>`;

const PAGE_WITH_BOTH = `<html><body>
  <a href="${ZIP_HREF}" class="book-download-btn">Download</a>
  <a href="${M4B_URL}">M4B audio book</a>
</body></html>`;

describe('LibrivoxApiService', () => {
  let service: LibrivoxApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LibrivoxApiService],
    }).compile();

    service = module.get<LibrivoxApiService>(LibrivoxApiService);
  });

  describe('getZipUrl', () => {
    it('fetches the LibriVox page and extracts the archive.org zip URL', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => PAGE_WITH_ZIP });

      const result = await service.getZipUrl(PAGE_URL);

      expect(mockFetch).toHaveBeenCalledWith(PAGE_URL);
      expect(result).toBe(ZIP_URL_ENCODED);
    });

    it('URL-encodes spaces in the extracted zip URL', async () => {
      const html = `<a href="https://archive.org/compress/foo_librivox/formats=64KBPS MP3&file=/foo.zip">Download</a>`;
      mockFetch.mockResolvedValue({ ok: true, text: async () => html });

      const result = await service.getZipUrl(PAGE_URL);

      expect(result).toContain('%20');
      expect(result).not.toContain(' ');
    });

    it('throws when the page request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(service.getZipUrl(PAGE_URL)).rejects.toThrow('HTTP 404');
    });

    it('throws when no archive.org zip link is found on the page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body>No download link here</body></html>',
      });

      await expect(service.getZipUrl(PAGE_URL)).rejects.toThrow(
        'No archive.org zip URL found',
      );
    });

    it('propagates network errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.getZipUrl(PAGE_URL)).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('getM4bUrl', () => {
    it('fetches the LibriVox page and extracts the first archive.org M4B URL', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => PAGE_WITH_M4B });

      const result = await service.getM4bUrl(PAGE_URL);

      expect(mockFetch).toHaveBeenCalledWith(PAGE_URL);
      expect(result).toBe(M4B_URL);
    });

    it('returns the first M4B URL when multiple audio links are present', async () => {
      const html = `
        <a href="https://archive.org/download/foo/foo_part1.m4b">Part 1</a>
        <a href="https://archive.org/download/foo/foo_part2.m4b">Part 2</a>
      `;
      mockFetch.mockResolvedValue({ ok: true, text: async () => html });

      const result = await service.getM4bUrl(PAGE_URL);

      expect(result).toContain('part1');
    });

    it('throws when no M4B link is found on the page', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => PAGE_WITH_ZIP });

      await expect(service.getM4bUrl(PAGE_URL)).rejects.toThrow(
        'No archive.org M4B URL found',
      );
    });

    it('throws when the page request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      await expect(service.getM4bUrl(PAGE_URL)).rejects.toThrow('HTTP 503');
    });

    it('both getZipUrl and getM4bUrl work on a page with both link types', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => PAGE_WITH_BOTH });
      expect(await service.getZipUrl(PAGE_URL)).toBe(ZIP_URL_ENCODED);

      mockFetch.mockResolvedValue({ ok: true, text: async () => PAGE_WITH_BOTH });
      expect(await service.getM4bUrl(PAGE_URL)).toBe(M4B_URL);
    });
  });
});
