import { AttestationAnswer } from '../../../../src/knowledge/rights/rights.ports';
import { RightsRecord, RightsService } from '../../../../src/knowledge/rights/rights.service';
import { IndexingPermission, RETRIEVAL_INDEXING_OPERATION } from '../../../../src/knowledge/retrieval/indexing-permission';
import { bookId, FakeDb, USER_A } from '../support/fixtures';
import { FIXTURE_TEXT_HASH as HASH, RESEARCH_OP, verifiedRecord } from '../support/rights-fixture';

const BOTH = [RESEARCH_OP, RETRIEVAL_INDEXING_OPERATION];

function setup(o: { records?: RightsRecord[]; hash?: string | null | 'throw'; attestation?: AttestationAnswer | 'throw'; dbFail?: boolean } = {}) {
  const db = new FakeDb();
  db.on(/FROM book_ai_rights/, (p) => {
    if (o.dbFail) throw new Error('db down');
    return (o.records ?? []).filter((r) => r.textHash === p[1]);
  });
  const textIdentity = { currentTextHash: jest.fn(async () => { if (o.hash === 'throw') throw new Error('x'); return o.hash === undefined ? HASH : o.hash; }) };
  const authority = { attest: jest.fn(async () => { if (o.attestation === 'throw') throw new Error('x'); return o.attestation ?? 'attested'; }) };
  const ownership = { check: jest.fn(async () => 'unknown' as const) };
  return {
    perm: new IndexingPermission(db as any, textIdentity, authority),
    rights: new RightsService(db as any, ownership, textIdentity, authority),
    db, textIdentity, authority, ownership,
  };
}
const B = bookId(1);

describe('IndexingPermission (NEM-023 §9.6, C-1) — default deny', () => {
  it('permits a verified, complete, well-formed, attested, current record granting retrieval_indexing', async () => {
    const { perm, authority } = setup({ records: [verifiedRecord({ permittedOperations: BOTH })] });
    expect(await perm.check(B)).toEqual({ permitted: true, textHash: HASH });
    expect(authority.attest).toHaveBeenCalledWith(expect.objectContaining({ bookId: B, textHash: HASH }));
  });

  it.each<[string, Parameters<typeof setup>[0], string]>([
    ['unbound / null text identity', { hash: null, records: [verifiedRecord({ permittedOperations: BOTH })] }, 'text_identity_unknown'],
    ['text identity throws', { hash: 'throw' }, 'text_identity_unknown'],
    ['no record', { records: [] }, 'no_rights_record'],
    ['record for another hash (stale)', { records: [verifiedRecord({ textHash: 'sha256:old', permittedOperations: BOTH })] }, 'no_rights_record'],
    ['database failure', { dbFail: true }, 'no_rights_record'],
    ['not verified', { records: [verifiedRecord({ status: 'pending', permittedOperations: BOTH })] }, 'not_verified'],
    ['incomplete', { records: [verifiedRecord({ edition: null, permittedOperations: BOTH })] }, 'incomplete_record'],
    ['malformed', { records: [verifiedRecord({ sourceUrl: 'ftp://x', permittedOperations: BOTH })] }, 'malformed_record'],
    ['research_analysis only (no retrieval_indexing)', { records: [verifiedRecord()] }, 'operation_not_permitted'],
    ['review date past', { records: [verifiedRecord({ reviewDate: '2026-02-01', permittedOperations: BOTH })] }, 'review_expired'],
    ['not attested', { records: [verifiedRecord({ permittedOperations: BOTH })], attestation: 'not_attested' }, 'not_attested'],
    ['authority unknown (unbound)', { records: [verifiedRecord({ permittedOperations: BOTH })], attestation: 'unknown' }, 'not_attested'],
    ['authority throws', { records: [verifiedRecord({ permittedOperations: BOTH })], attestation: 'throw' }, 'not_attested'],
  ])('denies: %s', async (_l, o, reason) => {
    const { perm } = setup(o);
    expect(await perm.check(B, new Date('2026-11-10T00:00:00Z'))).toEqual({ permitted: false, reason });
  });

  it('retrieval_indexing alone is indexable but never makes the book usable (RightsService denies research_analysis)', async () => {
    const { perm, rights } = setup({ records: [verifiedRecord({ permittedOperations: [RETRIEVAL_INDEXING_OPERATION] })] });
    expect((await perm.check(B)).permitted).toBe(true);
    expect(await rights.eligibility(USER_A, B, RESEARCH_OP)).toEqual({ eligible: false, reason: 'operation_not_permitted' });
  });

  it('has no user identity: never consults ownership', async () => {
    const { perm, ownership } = setup({ records: [verifiedRecord({ permittedOperations: BOTH, rightsBasis: 'licensed' })] });
    expect((await perm.check(B)).permitted).toBe(true); // ownership never makes a book indexable — and is never asked
    expect(ownership.check).not.toHaveBeenCalled();
  });

  describe('parity with RightsService book-level denials (§9.6)', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const variants: Parameters<typeof setup>[0][] = [
      { hash: null }, { hash: 'throw' }, { records: [] },
      { records: [verifiedRecord({ textHash: 'sha256:old', permittedOperations: BOTH })] },
      { records: [verifiedRecord({ status: 'revoked', permittedOperations: BOTH })] },
      { records: [verifiedRecord({ workTitle: '', permittedOperations: BOTH })] },
      { records: [verifiedRecord({ verifiedAt: '2099-01-01', permittedOperations: BOTH })] },
      { records: [verifiedRecord({ reviewDate: '2026-03-01', permittedOperations: BOTH })] },
      { records: [verifiedRecord({ permittedOperations: BOTH })], attestation: 'not_attested' },
      { records: [verifiedRecord({ permittedOperations: BOTH })], attestation: 'throw' },
      { records: [verifiedRecord({ permittedOperations: BOTH })] },
      { records: [verifiedRecord({ permittedOperations: [RETRIEVAL_INDEXING_OPERATION] })] },
      { records: [verifiedRecord({ permittedOperations: [RESEARCH_OP] })] },
    ];
    it.each(variants.map((v, i) => [i, v] as const))('variant %i: denies whenever RightsService denies with a book-level reason, and additionally needs retrieval_indexing', async (_i, v) => {
      const { perm, rights } = setup(v);
      const e = await rights.eligibility(USER_A, B, RESEARCH_OP, now);
      const p = await perm.check(B, now);
      if (!e.eligible && e.reason !== 'not_entitled' && e.reason !== 'operation_not_permitted') {
        expect(p).toEqual({ permitted: false, reason: e.reason });
      }
      const rec = v?.records?.find((r) => r.textHash === HASH);
      if (p.permitted) expect(rec?.permittedOperations).toContain(RETRIEVAL_INDEXING_OPERATION);
    });
  });
});
