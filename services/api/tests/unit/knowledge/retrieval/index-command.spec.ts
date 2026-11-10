import { runIndexCommand } from '../../../../src/knowledge/retrieval/index-command';

const ID = '0b6b5f0e-3a8e-4c55-9a43-7d1c2b9e8f10';
const indexer = () => ({
  indexBook: jest.fn().mockResolvedValue({ outcome: 'skipped_scope', reason: 'text_identity_unknown' }),
  indexAll: jest.fn().mockResolvedValue({ indexed: 0, skipped_scope: 3, skipped_limit: 0, exists: 0, failed: 0 }),
  prune: jest.fn().mockResolvedValue({ sets: 1, rows: 10 }),
  purge: jest.fn().mockResolvedValue({ sets: 2, rows: 20 }),
});

describe('runIndexCommand (§5.3)', () => {
  it('index <bookId>, index all, prune, purge <bookId>', async () => {
    const ix = indexer();
    expect(await runIndexCommand(['index', ID], ix)).toEqual({ code: 0, output: JSON.stringify({ outcome: 'skipped_scope', reason: 'text_identity_unknown' }) });
    expect(ix.indexBook).toHaveBeenCalledWith(ID);
    expect((await runIndexCommand(['index', 'all'], ix)).output).toContain('"skipped_scope":3');
    expect((await runIndexCommand(['prune'], ix)).output).toBe('{"sets":1,"rows":10}');
    expect((await runIndexCommand(['purge', ID], ix)).output).toBe('{"sets":2,"rows":20}');
    expect(ix.purge).toHaveBeenCalledWith(ID);
  });
  it('a failed index exits 1', async () => {
    const ix = indexer();
    ix.indexBook.mockResolvedValue({ outcome: 'failed', reason: 'text_unreadable' });
    expect((await runIndexCommand(['index', ID], ix)).code).toBe(1);
  });
  it.each([[[]], [['index']], [['index', 'not-a-uuid']], [['purge']], [['purge', 'all']], [['prune', 'x']], [['drop']]])('usage error for %j', async (argv) => {
    const ix = indexer();
    expect(await runIndexCommand(argv as string[], ix)).toEqual({ code: 2, output: expect.stringMatching(/^usage:/) });
    for (const f of Object.values(ix)) expect(f).not.toHaveBeenCalled();
  });
});
