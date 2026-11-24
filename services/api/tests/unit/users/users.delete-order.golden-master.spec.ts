/**
 * SP-1-I1 — account-deletion order golden master.
 *
 * Captured on the UNCHANGED UsersService.deleteAccount (main 8f2f294) before implementation. Records the
 * exact ordered sequence of SQL statements, the user-row delete and the farewell email. SP-1-I1 may only
 * ADD the push-token cleanup after the user-row delete; every other step must keep its statement and order.
 */
import { UsersService } from '../../../src/users/users.service';

function setup(user: Record<string, unknown> | null) {
  const log: Array<Record<string, unknown>> = [];
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(user),
    delete: jest.fn(async (id: string) => { log.push({ step: 'repo.delete', id }); }),
  };
  const dataSource = {
    manager: { query: jest.fn(async (sql: string, params: unknown[]) => { log.push({ step: 'query', sql, params }); }) },
  };
  const email = { sendFarewell: jest.fn(async (...args: unknown[]) => { log.push({ step: 'sendFarewell', args }); }) };
  const svc = new UsersService(repo as any, dataSource as any, email as any);
  return { svc, log, repo, dataSource, email };
}

describe('UsersService.deleteAccount order golden master (SP-1-I1)', () => {
  it('records the full deletion sequence for a user with an email', async () => {
    const { svc, log } = setup({ id: 'u-1', email: 'reader@example.com', name: 'Ana', uiLanguage: 'en' });
    await svc.deleteAccount('u-1');
    expect(log).toMatchSnapshot('sequence/with-email');
  });

  it('records the sequence for a user without an email (no farewell)', async () => {
    const { svc, log } = setup({ id: 'u-2', email: null, name: null, uiLanguage: 'es' });
    await svc.deleteAccount('u-2');
    expect(log).toMatchSnapshot('sequence/no-email');
  });

  it('unknown user: nothing happens', async () => {
    const { svc, log } = setup(null);
    await svc.deleteAccount('ghost');
    expect(log).toEqual([]);
  });
});
