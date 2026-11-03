import { shareFragment, getTextColor, getLuminance, shareErrorKey } from '../../../lib/share-utils';
import { en } from '../../../lib/i18n/en';
import { es } from '../../../lib/i18n/es';
import { apiFetch } from '../../../lib/api';

jest.mock('../../../lib/api', () => ({ apiFetch: jest.fn() }));
const mockApiFetch = apiFetch as jest.Mock;

describe('shareFragment', () => {
  beforeEach(() => jest.clearAllMocks());

  const params = { format: 'ig-post', font: 'playfair', bgType: 'solid', bgColors: ['#000000'] } as any;

  it('returns the invite page URL and the image URL', async () => {
    mockApiFetch.mockResolvedValueOnce({
      url: 'https://noetia.app/s/abc1234567',
      imageUrl: 'https://storage.noetia.app/images/share/x.png',
    });

    const res = await shareFragment('frag-1', params);

    expect(res).toEqual({
      pageUrl: 'https://noetia.app/s/abc1234567',
      imageUrl: 'https://storage.noetia.app/images/share/x.png',
    });
  });

  it('posts to the fragment share endpoint with the mapped platform/format', async () => {
    mockApiFetch.mockResolvedValueOnce({ url: 'p', imageUrl: 'i' });

    await shareFragment('frag-9', params);

    const [path, init] = mockApiFetch.mock.calls[0];
    expect(path).toBe('/fragments/frag-9/share');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ platform: 'instagram', format: 'post' });
  });

  it('falls back to the image URL when the response has no imageUrl', async () => {
    mockApiFetch.mockResolvedValueOnce({ url: 'https://only-image.png' });

    const res = await shareFragment('frag-1', params);

    expect(res.pageUrl).toBe('https://only-image.png');
    expect(res.imageUrl).toBe('https://only-image.png');
  });
});

describe('getTextColor (auto-contrast)', () => {
  it('picks white text on a dark background', () => {
    expect(getTextColor(['#0D1B2A'])).toBe('#FFFFFF');
  });

  it('picks dark text on a light background', () => {
    expect(getTextColor(['#FFFFFF'])).toBe('#0D1B2A');
  });

  it('averages the per-colour luminances across a gradient', () => {
    // Two dark colours stay dark → white text.
    expect(getTextColor(['#000000', '#1A4A4A'])).toBe('#FFFFFF');
  });
});

describe('getLuminance', () => {
  it('is 0 for black and ~1 for white', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0, 5);
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('shareErrorKey (NEM-016)', () => {
  it('maps a refused (edited) quote to the quotation-integrity message', () => {
    expect(shareErrorKey({ status: 422, data: { error: 'quote_not_in_source', reason: 'not_in_source' } })).toBe('errorQuoteNotInSource');
  });

  it('maps an unshareable book, a rejected background and rate limiting', () => {
    expect(shareErrorKey({ status: 422, data: { error: 'book_not_shareable' } })).toBe('errorBookNotShareable');
    expect(shareErrorKey({ status: 400, data: { error: 'unsupported_background_image' } })).toBe('errorBackground');
    expect(shareErrorKey({ status: 429, data: { error: 'rate_limited' } })).toBe('errorRateLimited');
    expect(shareErrorKey({ status: 429 })).toBe('errorRateLimited');
  });

  it('returns null for anything else so the generic message is shown', () => {
    expect(shareErrorKey(new Error('network'))).toBeNull();
    expect(shareErrorKey({ status: 502, data: {} })).toBeNull();
    expect(shareErrorKey(null)).toBeNull();
  });

  it('every mapped key has EN and ES copy', () => {
    for (const k of ['errorQuoteNotInSource', 'errorBookNotShareable', 'errorRateLimited', 'errorBackground'] as const) {
      expect(en.shareCard[k]).toBeTruthy();
      expect(es.shareCard[k]).toBeTruthy();
    }
  });

  it('surfaces the API error code from shareFragment so the modal can map it', async () => {
    mockApiFetch.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 422, data: { error: 'quote_not_in_source' } }));
    const err = await shareFragment('f', { format: 'ig-post', font: 'playfair', bgType: 'solid', bgColors: ['#000000'] } as any).catch((e) => e);
    expect(shareErrorKey(err)).toBe('errorQuoteNotInSource');
  });
});
