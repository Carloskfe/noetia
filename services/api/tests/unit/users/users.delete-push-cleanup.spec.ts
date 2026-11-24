/** SP-1-I1 — best-effort push-token cleanup in deleteAccount (SP-D13). */
import { Logger } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';

const PUSH_CLEANUP = 'DELETE FROM "push_tokens" WHERE "userId" = $1';
const USER = { id: 'u-del', email: 'gone@example.com', name: 'Ana', uiLanguage: 'es' };

function setup(failOn?: (sql: string) => boolean, repoDeleteFails = false) {
  const order: string[] = [];
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(USER),
    delete: jest.fn(async () => {
      order.push('repo.delete');
      if (repoDeleteFails) throw new Error('user delete failed');
    }),
  };
  const dataSource = {
    manager: {
      query: jest.fn(async (sql: string) => {
        order.push(sql);
        if (failOn?.(sql)) throw new Error(`failed: ${sql}`);
      }),
    },
  };
  const email = { sendFarewell: jest.fn(async () => { order.push('sendFarewell'); }) };
  return { svc: new UsersService(repo as any, dataSource as any, email as any), order, email, repo };
}

let warnings: string[];
beforeEach(() => {
  warnings = [];
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((...a: unknown[]) => { warnings.push(a.map(String).join(' ')); });
});
afterEach(() => jest.restoreAllMocks());

describe('deleteAccount push-token cleanup (SP-1-I1)', () => {
  it('9. cleanup runs once, immediately after the user-row delete and before the farewell email', async () => {
    const { svc, order } = setup();
    await svc.deleteAccount('u-del');
    const i = order.indexOf(PUSH_CLEANUP);
    expect(order[i - 1]).toBe('repo.delete');
    expect(order[i + 1]).toBe('sendFarewell');
    expect(order.filter((s) => s === PUSH_CLEANUP)).toHaveLength(1);
  });

  it('10. cleanup failure does not fail the deletion and the farewell email is still sent', async () => {
    const { svc, order, email } = setup((sql) => sql === PUSH_CLEANUP);
    await expect(svc.deleteAccount('u-del')).resolves.toBeUndefined();
    expect(email.sendFarewell).toHaveBeenCalledWith('gone@example.com', 'Ana', 'es');
    expect(order.slice(-2)).toEqual([PUSH_CLEANUP, 'sendFarewell']);
    expect(warnings).toEqual(['account deletion: push-token cleanup failed (registrations left inert)']);
    for (const w of warnings) {
      expect(w).not.toContain('u-del');
      expect(w).not.toContain('gone@example.com');
    }
  });

  it('11. an earlier deletion failure keeps its current behaviour: rejects, no user delete, no cleanup, no email', async () => {
    const { svc, order, email, repo } = setup((sql) => sql.includes('"token_ledger"'));
    await expect(svc.deleteAccount('u-del')).rejects.toThrow('failed: DELETE FROM "token_ledger"');
    expect(repo.delete).not.toHaveBeenCalled();
    expect(order).not.toContain(PUSH_CLEANUP);
    expect(email.sendFarewell).not.toHaveBeenCalled();
  });

  it('11b. a user-row delete failure keeps its current behaviour: rejects, no cleanup, no email', async () => {
    const { svc, order, email } = setup(undefined, true);
    await expect(svc.deleteAccount('u-del')).rejects.toThrow('user delete failed');
    expect(order).not.toContain(PUSH_CLEANUP);
    expect(email.sendFarewell).not.toHaveBeenCalled();
  });
});
