/**
 * SP-1-I1 — push notification golden master.
 *
 * Captured on the UNCHANGED PushService (main 8f2f294) and committed before any implementation change.
 * Records the exact Expo request (URL, method, headers, JSON body: to/title/body/data/sound) for all five
 * push types in Spanish and English for valid, existing recipients. SP-1-I1 must keep these byte-identical.
 * Transport is mocked: no request ever leaves the process.
 */
import { PushService } from '../../../src/push/push.service';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const SCHEDULED_AT = new Date('2026-07-01T18:30:00Z');

const CASES: Array<[string, string, Record<string, unknown>]> = [
  ['invite_accepted', 'invite_accepted', { planName: 'Duo' }],
  ['gift_claimed/1', 'gift_claimed', { tokenCount: 1 }],
  ['gift_claimed/3', 'gift_claimed', { tokenCount: 3 }],
  ['club_new_book', 'club_new_book', { clubId: 'club-1', bookId: 'book-1' }],
  ['club_nearby_comment', 'club_nearby_comment', { clubId: 'club-1', bookId: 'book-1', phraseIndex: 42 }],
  ['club_session_scheduled', 'club_session_scheduled', {
    clubId: 'club-1', sessionId: 'session-1', title: 'Lectura <conjunta> & café', scheduledAt: SCHEDULED_AT,
  }],
];

function makeService(tokens: string[], user: Record<string, unknown> | null) {
  const tokenRepo = { findBy: jest.fn().mockResolvedValue(tokens.map((token) => ({ userId: 'u-1', token }))), upsert: jest.fn() };
  const userRepo = { findOneBy: jest.fn().mockResolvedValue(user) };
  return new PushService(tokenRepo as any, userRepo as any);
}

const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url, ...init }));

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'ok' } }) });
});

describe('PushService golden master (SP-1-I1)', () => {
  describe.each(['es', 'en'])('uiLanguage=%s', (lang) => {
    it.each(CASES)('%s', async (label, type, vars) => {
      await makeService(['ExponentPushToken[gm-device-1]'], { id: 'u-1', uiLanguage: lang }).sendToUser('u-1', type, vars);
      expect(calls()).toMatchSnapshot(`${label}/${lang}`);
    });
  });

  it('existing user with no stored language falls back to Spanish', async () => {
    await makeService(['ExponentPushToken[gm-device-1]'], { id: 'u-1', uiLanguage: null }).sendToUser('u-1', 'invite_accepted', { planName: 'Duo' });
    expect(calls()).toMatchSnapshot('invite_accepted/null-language');
  });

  it("existing user with stored 'fr-CA' receives the Spanish payload (unchanged)", async () => {
    await makeService(['ExponentPushToken[gm-device-1]'], { id: 'u-1', uiLanguage: 'fr-CA' }).sendToUser('u-1', 'gift_claimed', { tokenCount: 3 });
    expect(calls()).toMatchSnapshot('gift_claimed/fr-CA-stored');
  });

  it('multi-device: one request per token, in token order', async () => {
    await makeService(['ExponentPushToken[gm-device-1]', 'ExpoPushToken[gm-device-2]'], { id: 'u-1', uiLanguage: 'en' })
      .sendToUser('u-1', 'invite_accepted', { planName: 'Family' });
    expect(calls()).toMatchSnapshot('invite_accepted/two-devices');
  });

  it('no tokens → no request', async () => {
    await makeService([], { id: 'u-1', uiLanguage: 'es' }).sendToUser('u-1', 'invite_accepted', {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('default vars → payload still produced for existing user', async () => {
    await makeService(['ExponentPushToken[gm-device-1]'], { id: 'u-1', uiLanguage: 'es' }).sendToUser('u-1', 'club_new_book');
    expect(calls()).toMatchSnapshot('club_new_book/no-vars');
  });
});
