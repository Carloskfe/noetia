/**
 * SP-1-I1 / F-SP1-I1-1 — a failed Expo submission must never leak identifiers through logs.
 *
 * The exception raised by `fetch` is uncontrolled text. These tests make it carry a complete Expo
 * token, an email address and the user ID, then assert that none of them reaches any logger channel,
 * that the failure stays best-effort, and that the remaining devices are still attempted.
 * Payload byte-identity for successful sends is covered by push.golden-master.spec.ts (unchanged).
 */
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../src/users/user.entity';
import { PushToken } from '../../../src/push/push-token.entity';
import { PushService, PUSH_SUBMISSION_FAILED_LOG } from '../../../src/push/push.service';

const USER_ID = '7f3c2a9e-1b4d-4e8a-9c21-5d6e7f8a9b0c';
const TOKEN = 'ExponentPushToken[xXsEcReTdEvIcE0123456789]';
const OTHER_TOKEN = 'ExponentPushToken[sEcOnDdEvIcE9876543210]';
const EMAIL = 'reader.private@example.com';
const LEAKY_MESSAGE =
  `request to https://exp.host/--/api/v2/push/send failed for to=${TOKEN} ` +
  `(user ${USER_ID}, ${EMAIL}): socket hang up`;
const SECRETS = [TOKEN, OTHER_TOKEN, 'xXsEcReTdEvIcE0123456789', USER_ID, EMAIL, 'socket hang up'];

const LOG_METHODS = ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const;

describe('PushService — submission failure logging (F-SP1-I1-1)', () => {
  let service: PushService;
  let tokenRepo: { findBy: jest.Mock; manager: { transaction: jest.Mock } };
  let userRepo: { findOneBy: jest.Mock };
  let spies: jest.SpyInstance[];
  let fetchMock: jest.Mock;
  const savedFetch = global.fetch;

  const captured = (): string =>
    spies
      .flatMap((s) => s.mock.calls)
      .map((args: unknown[]) =>
        args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      )
      .join('\n');

  beforeEach(async () => {
    spies = [
      ...LOG_METHODS.map((m) => (jest.spyOn(Logger.prototype, m) as jest.SpyInstance).mockImplementation(() => undefined)),
      ...(['log', 'warn', 'error', 'info', 'debug'] as const).map((m) =>
        jest.spyOn(console, m).mockImplementation(() => undefined),
      ),
    ];
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    tokenRepo = {
      findBy: jest.fn().mockResolvedValue([{ token: TOKEN }]),
      manager: { transaction: jest.fn() },
    };
    userRepo = { findOneBy: jest.fn().mockResolvedValue({ id: USER_ID, email: EMAIL, uiLanguage: 'es' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: getRepositoryToken(PushToken), useValue: tokenRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    service = moduleRef.get(PushService);
    spies.forEach((s) => s.mockClear()); // drop Nest bootstrap output; capture only service logs
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    global.fetch = savedFetch;
  });

  it('logs only the static message when the rejection carries a token, email and user ID', async () => {
    fetchMock.mockRejectedValue(new Error(LEAKY_MESSAGE));

    await expect(service.sendToUser(USER_ID, 'gift_claimed', { recipientEmail: EMAIL })).resolves.toBeUndefined();

    const warn = jest.mocked(Logger.prototype.warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual([PUSH_SUBMISSION_FAILED_LOG]);
    const out = captured();
    for (const secret of SECRETS) expect(out).not.toContain(secret);
  });

  it('withholds identifiers carried in the stack, cause or a non-Error rejection', async () => {
    const withCause = Object.assign(new Error(LEAKY_MESSAGE), { cause: new Error(`token ${TOKEN}`) });
    withCause.stack = `Error: ${LEAKY_MESSAGE}\n    at fetch (${EMAIL})`;
    fetchMock.mockRejectedValueOnce(withCause).mockRejectedValueOnce(LEAKY_MESSAGE);
    tokenRepo.findBy.mockResolvedValue([{ token: TOKEN }, { token: OTHER_TOKEN }]);

    await expect(service.sendToUser(USER_ID, 'invite_accepted', { planName: 'Duo' })).resolves.toBeUndefined();

    const warn = jest.mocked(Logger.prototype.warn);
    expect(warn.mock.calls).toEqual([[PUSH_SUBMISSION_FAILED_LOG], [PUSH_SUBMISSION_FAILED_LOG]]);
    const out = captured();
    for (const secret of SECRETS) expect(out).not.toContain(secret);
  });

  it('stays best-effort: one device failing does not stop the others or propagate', async () => {
    tokenRepo.findBy.mockResolvedValue([{ token: TOKEN }, { token: OTHER_TOKEN }]);
    fetchMock.mockRejectedValueOnce(new Error(LEAKY_MESSAGE)).mockResolvedValueOnce({ ok: true });

    await expect(service.sendToUser(USER_ID, 'invite_accepted', { planName: 'Duo' })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recipients = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).to);
    expect(recipients).toEqual([TOKEN, OTHER_TOKEN]);
    expect(jest.mocked(Logger.prototype.warn)).toHaveBeenCalledTimes(1);
    for (const secret of SECRETS) expect(captured()).not.toContain(secret);
  });

  it('logs nothing on a successful submission', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await service.sendToUser(USER_ID, 'invite_accepted', { planName: 'Duo' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captured()).toBe('');
  });

  it('the static message itself contains no placeholder or identifier', () => {
    expect(PUSH_SUBMISSION_FAILED_LOG).toBe('Push submission failed (details withheld)');
    expect(PUSH_SUBMISSION_FAILED_LOG).not.toMatch(/\$\{|PushToken|@|[0-9a-f]{8}-/i);
  });
});
