/**
 * ShareModal unit tests
 * Tests focus on pure logic: getLuminance, getTextColor, FORMAT_PLATFORM_MAP,
 * and shareFragment integration — the component itself is a client component
 * and tested via the share-utils logic it depends on.
 */
import {
  FORMAT_PLATFORM_MAP,
  SHARE_FORMAT_LABELS,
  getLuminance,
  getTextColor,
  shareFragment,
  ShareFormat,
} from '../../../lib/share-utils';

const sessionStorageMock = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true });
});

// ── Format aspect ratio coverage (via FORMAT_PLATFORM_MAP) ───────────────────

describe('FORMAT_PLATFORM_MAP completeness', () => {
  const formats: ShareFormat[] = [
    'ig-post', 'ig-story', 'fb-post', 'fb-story', 'li-post',
    'wa-pic', 'wa-story', 'reel', 'twitter-card',
  ];

  it('has entries for all 9 share formats', () => {
    formats.forEach((f) => {
      expect(FORMAT_PLATFORM_MAP[f]).toBeDefined();
    });
  });

  it('wa is no longer in the map', () => {
    expect((FORMAT_PLATFORM_MAP as Record<string, unknown>)['wa']).toBeUndefined();
  });

  it('story formats map to story format string', () => {
    expect(FORMAT_PLATFORM_MAP['ig-story'].format).toBe('story');
    expect(FORMAT_PLATFORM_MAP['fb-story'].format).toBe('story');
    expect(FORMAT_PLATFORM_MAP['wa-story'].format).toBe('wa-story');
  });

  it('post formats map to correct format strings', () => {
    expect(FORMAT_PLATFORM_MAP['ig-post'].format).toBe('post');
    expect(FORMAT_PLATFORM_MAP['fb-post'].format).toBe('post');
    expect(FORMAT_PLATFORM_MAP['li-post'].format).toBe('post');
    expect(FORMAT_PLATFORM_MAP['wa-pic'].format).toBe('wa-pic');
    expect(FORMAT_PLATFORM_MAP['reel'].format).toBe('reel');
    expect(FORMAT_PLATFORM_MAP['twitter-card'].format).toBe('twitter-card');
  });
});

describe('SHARE_FORMAT_LABELS', () => {
  it('has a non-empty label for every format', () => {
    (Object.keys(FORMAT_PLATFORM_MAP) as ShareFormat[]).forEach((f) => {
      expect(SHARE_FORMAT_LABELS[f]).toBeTruthy();
    });
  });

  it('has 9 format labels', () => {
    expect(Object.keys(SHARE_FORMAT_LABELS)).toHaveLength(9);
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

  it('sends wa-pic format and platform=whatsapp for wa-pic', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'wa-pic' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('whatsapp');
    expect(body.format).toBe('wa-pic');
  });

  it('sends wa-story format and platform=whatsapp for wa-story', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'wa-story' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('whatsapp');
    expect(body.format).toBe('wa-story');
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

  it('sends twitter-card format routed through linkedin renderer', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://example.com/card.png' }),
    } as Response);

    await shareFragment('frag-1', { ...defaultParams, format: 'twitter-card' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.platform).toBe('linkedin');
    expect(body.format).toBe('twitter-card');
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
