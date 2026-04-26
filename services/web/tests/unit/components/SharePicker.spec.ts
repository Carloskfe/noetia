import {
  FORMAT_PLATFORM_MAP,
  SHARE_FORMAT_LABELS,
  ShareFormat,
  getLuminance,
  getTextColor,
  shareFragment,
} from '../../../lib/share-utils';

const mockStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true });
});

// ── FORMAT_PLATFORM_MAP ────────────────────────────────────────────────────────

describe('FORMAT_PLATFORM_MAP', () => {
  it('covers all six share formats', () => {
    const keys = Object.keys(FORMAT_PLATFORM_MAP);
    expect(keys).toEqual(expect.arrayContaining(['ig-post', 'ig-story', 'fb-post', 'fb-story', 'li-post', 'wa']));
    expect(keys).toHaveLength(6);
  });

  it('maps ig-story to instagram story', () => {
    expect(FORMAT_PLATFORM_MAP['ig-story']).toEqual({ platform: 'instagram', format: 'story' });
  });

  it('maps fb-story to facebook story', () => {
    expect(FORMAT_PLATFORM_MAP['fb-story']).toEqual({ platform: 'facebook', format: 'story' });
  });

  it('maps li-post to linkedin post', () => {
    expect(FORMAT_PLATFORM_MAP['li-post']).toEqual({ platform: 'linkedin', format: 'post' });
  });
});

describe('SHARE_FORMAT_LABELS', () => {
  it('has a label for all six formats', () => {
    const formats: ShareFormat[] = ['ig-post', 'ig-story', 'fb-post', 'fb-story', 'li-post', 'wa'];
    formats.forEach((f) => {
      expect(typeof SHARE_FORMAT_LABELS[f]).toBe('string');
      expect(SHARE_FORMAT_LABELS[f].length).toBeGreaterThan(0);
    });
  });
});

// ── getLuminance ──────────────────────────────────────────────────────────────

describe('getLuminance', () => {
  it('returns 0 for black', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('returns ~1 for white', () => {
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('returns low value for dark navy', () => {
    expect(getLuminance('#0D1B2A')).toBeLessThan(0.05);
  });

  it('works without leading hash', () => {
    expect(getLuminance('FFFFFF')).toBeCloseTo(1, 2);
  });
});

// ── getTextColor ──────────────────────────────────────────────────────────────

describe('getTextColor', () => {
  it('returns white for dark background', () => {
    expect(getTextColor(['#000000'])).toBe('#FFFFFF');
  });

  it('returns dark navy for light background', () => {
    expect(getTextColor(['#FFFFFF'])).toBe('#0D1B2A');
  });

  it('returns white for dark navy background', () => {
    expect(getTextColor(['#0D1B2A'])).toBe('#FFFFFF');
  });

  it('averages luminance for gradient stops', () => {
    // Two dark stops → white text
    expect(getTextColor(['#0D1B2A', '#1A4A4A'])).toBe('#FFFFFF');
  });
});

// ── shareFragment ─────────────────────────────────────────────────────────────

describe('shareFragment', () => {
  const defaultParams = {
    format: 'ig-post' as ShareFormat,
    font: 'lato',
    bgType: 'solid' as const,
    bgColors: ['#0D1B2A'],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the URL from a successful share call', async () => {
    const expectedUrl = 'http://storage/images/card.png?token=abc';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: expectedUrl }),
    } as Response);

    const result = await shareFragment('frag-1', defaultParams);
    expect(result).toBe(expectedUrl);
  });

  it('calls the correct API endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/img.png' }),
    } as Response);

    await shareFragment('frag-42', defaultParams);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/fragments/frag-42/share');
  });

  it('sends platform and format derived from shareFormat', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/img.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'ig-story' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('instagram');
    expect(body.format).toBe('story');
  });

  it('sends font, bgType, and bgColors in body', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/img.png' }),
    } as Response);

    await shareFragment('frag-1', {
      format: 'fb-post',
      font: 'playfair',
      bgType: 'gradient',
      bgColors: ['#0D1B2A', '#1A4A4A'],
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.font).toBe('playfair');
    expect(body.bgType).toBe('gradient');
    expect(body.bgColors).toEqual(['#0D1B2A', '#1A4A4A']);
  });

  it('throws when the API returns an error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ message: 'image generation failed' }),
    } as Response);

    await expect(shareFragment('frag-1', defaultParams)).rejects.toThrow();
  });
});
