/**
 * ShareModal unit tests
 * Tests focus on pure logic: getLuminance, getTextColor, FORMAT_PLATFORM_MAP,
 * and shareFragment integration — the component itself is a client component
 * and tested via the share-utils logic it depends on.
 */
import {
  BG_PRESETS,
  FORMAT_PLATFORM_MAP,
  FONTS,
  GOOGLE_FONTS_URL,
  SHARE_FORMAT_LABELS,
  getLuminance,
  getTextColor,
  shareFragment,
  ShareFormat,
} from '../../../lib/share-utils';

const localStorageMock = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
});

// ── FONTS registry ────────────────────────────────────────────────────────────

describe('FONTS registry', () => {
  const REQUIRED_FONT_IDS = ['playfair', 'montserrat', 'merriweather', 'oswald', 'baskerville', 'dancing', 'pacifico'];

  it('contains all 7 required fonts', () => {
    const ids = FONTS.map((f) => f.id);
    REQUIRED_FONT_IDS.forEach((id) => expect(ids).toContain(id));
  });

  it('has exactly 7 entries', () => {
    expect(FONTS).toHaveLength(7);
  });

  it('every font has a non-empty id, label, and css', () => {
    FONTS.forEach((f) => {
      expect(f.id).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(f.css).toBeTruthy();
    });
  });

  it('baskerville, oswald and pacifico are in the registry', () => {
    const ids = FONTS.map((f) => f.id);
    expect(ids).toContain('baskerville');
    expect(ids).toContain('oswald');
    expect(ids).toContain('pacifico');
  });

  it('GOOGLE_FONTS_URL includes all font family names', () => {
    expect(GOOGLE_FONTS_URL).toContain('Playfair');
    expect(GOOGLE_FONTS_URL).toContain('Montserrat');
    expect(GOOGLE_FONTS_URL).toContain('Merriweather');
    expect(GOOGLE_FONTS_URL).toContain('Oswald');
    expect(GOOGLE_FONTS_URL).toContain('Libre+Baskerville');
    expect(GOOGLE_FONTS_URL).toContain('Dancing');
    expect(GOOGLE_FONTS_URL).toContain('Pacifico');
  });
});

// ── BG_PRESETS (Noetia background gallery) ───────────────────────────────────

describe('BG_PRESETS', () => {
  it('offers exactly 18 Noetia gallery backgrounds', () => {
    expect(BG_PRESETS).toHaveLength(18);
  });

  it('every preset points at a /backgrounds/imagen-N.jpg static asset', () => {
    BG_PRESETS.forEach((url, i) => {
      expect(url).toBe(`/backgrounds/imagen-${i + 1}.jpg`);
    });
  });

  it('has no duplicate entries', () => {
    expect(new Set(BG_PRESETS).size).toBe(BG_PRESETS.length);
  });
});

// ── Format aspect ratio coverage (via FORMAT_PLATFORM_MAP) ───────────────────

describe('FORMAT_PLATFORM_MAP completeness', () => {
  const formats: ShareFormat[] = [
    'ig-post', 'ig-story', 'fb-post', 'fb-story', 'li-post',
    'pin-post', 'pin-square', 'reel',
  ];

  it('has entries for all 8 share formats', () => {
    formats.forEach((f) => {
      expect(FORMAT_PLATFORM_MAP[f]).toBeDefined();
    });
  });

  it('whatsapp is no longer in the map', () => {
    expect((FORMAT_PLATFORM_MAP as Record<string, unknown>)['wa-pic']).toBeUndefined();
    expect((FORMAT_PLATFORM_MAP as Record<string, unknown>)['wa-story']).toBeUndefined();
  });

  it('story formats map to story format string', () => {
    expect(FORMAT_PLATFORM_MAP['ig-story'].format).toBe('story');
    expect(FORMAT_PLATFORM_MAP['fb-story'].format).toBe('story');
  });

  it('post formats map to correct format strings', () => {
    expect(FORMAT_PLATFORM_MAP['ig-post'].format).toBe('post');
    expect(FORMAT_PLATFORM_MAP['fb-post'].format).toBe('post');
    expect(FORMAT_PLATFORM_MAP['li-post'].format).toBe('post');
    expect(FORMAT_PLATFORM_MAP['reel'].format).toBe('reel');
    expect(FORMAT_PLATFORM_MAP['pin-post'].format).toBe('pin');
    expect(FORMAT_PLATFORM_MAP['pin-square'].format).toBe('pin-square');
  });

  it('pinterest formats route to pinterest platform', () => {
    expect(FORMAT_PLATFORM_MAP['pin-post'].platform).toBe('pinterest');
    expect(FORMAT_PLATFORM_MAP['pin-square'].platform).toBe('pinterest');
  });
});

describe('SHARE_FORMAT_LABELS', () => {
  it('has a non-empty label for every format', () => {
    (Object.keys(FORMAT_PLATFORM_MAP) as ShareFormat[]).forEach((f) => {
      expect(SHARE_FORMAT_LABELS[f]).toBeTruthy();
    });
  });

  it('has 8 format labels', () => {
    expect(Object.keys(SHARE_FORMAT_LABELS)).toHaveLength(8);
  });
});

// ── social publish: shareFragment with textColor + platform ──────────────────

describe('shareFragment with social publish params', () => {
  const defaultParams = {
    format: 'ig-post' as ShareFormat,
    font: 'lato',
    bgType: 'solid' as const,
    bgColors: ['#0D1B2A'],
  };

  afterEach(() => jest.restoreAllMocks());

  it('sends textColor when provided via params', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, textColor: '#FF6B6B' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.textColor).toBe('#FF6B6B');
  });

  it('omits textColor when not in params', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', defaultParams);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty('textColor');
  });
});

// ── getLuminance ──────────────────────────────────────────────────────────────

describe('getLuminance', () => {
  it('black has luminance 0', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0);
  });

  it('white has luminance ~1', () => {
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 1);
  });

  it('luminance is between 0 and 1 for any colour', () => {
    ['#FF0000', '#00FF00', '#0000FF', '#888888', '#0D1B2A'].forEach((hex) => {
      const lum = getLuminance(hex);
      expect(lum).toBeGreaterThanOrEqual(0);
      expect(lum).toBeLessThanOrEqual(1);
    });
  });
});

// ── getTextColor ──────────────────────────────────────────────────────────────

describe('getTextColor', () => {
  it('dark background → white text', () => {
    expect(getTextColor(['#000000'])).toBe('#FFFFFF');
    expect(getTextColor(['#0D1B2A'])).toBe('#FFFFFF');
    expect(getTextColor(['#1A4A4A'])).toBe('#FFFFFF');
  });

  it('light background → dark navy text', () => {
    expect(getTextColor(['#FFFFFF'])).toBe('#0D1B2A');
    expect(getTextColor(['#F5E6C8'])).toBe('#0D1B2A');
  });

  it('averages two gradient stops for text colour decision', () => {
    expect(getTextColor(['#0D1B2A', '#1A4A4A'])).toBe('#FFFFFF');
  });
});

// ── shareFragment integration ─────────────────────────────────────────────────

describe('shareFragment', () => {
  const defaultParams = {
    format: 'ig-post' as ShareFormat,
    font: 'lato',
    bgType: 'solid' as const,
    bgColors: ['#0D1B2A'],
  };

  afterEach(() => jest.restoreAllMocks());

  it('sends format=post and platform=instagram for ig-post', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', defaultParams);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('instagram');
    expect(body.format).toBe('post');
  });

  it('sends pin format and platform=pinterest for pin-post', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'pin-post' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('pinterest');
    expect(body.format).toBe('pin');
  });

  it('sends pin-square format and platform=pinterest for pin-square', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'pin-square' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('pinterest');
    expect(body.format).toBe('pin-square');
  });

  it('sends reel format and platform=instagram for reel', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'reel' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('instagram');
    expect(body.format).toBe('reel');
  });

  it('sends reel format routed through instagram renderer', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'reel' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('instagram');
    expect(body.format).toBe('reel');
  });

  it('sends format=story and platform=instagram for ig-story', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'ig-story' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('instagram');
    expect(body.format).toBe('story');
  });

  it('sends gradient bgType and two bgColors', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', {
      format: 'fb-post',
      font: 'playfair',
      bgType: 'gradient',
      bgColors: ['#FF0000', '#0000FF'],
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.bgType).toBe('gradient');
    expect(body.bgColors).toEqual(['#FF0000', '#0000FF']);
  });

  it('includes textColor in payload when provided', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, textColor: '#FF6B6B' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.textColor).toBe('#FF6B6B');
  });

  it('omits textColor from payload when not provided', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', defaultParams);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty('textColor');
  });

  it('throws on API failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ message: 'error' }),
    } as Response);

    await expect(shareFragment('frag-1', defaultParams)).rejects.toThrow();
  });

  it('loading state: returns url on success', async () => {
    const url = 'http://storage/images/test.png';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url }),
    } as Response);

    const result = await shareFragment('frag-1', defaultParams);
    expect(result).toBe(url);
  });
});
