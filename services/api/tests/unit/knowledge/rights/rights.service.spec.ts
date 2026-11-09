import { OwnershipAnswer, UnboundOwnershipPort, UnboundTextIdentityPort } from '../../../../src/knowledge/rights/rights.ports';
import { isCompleteRecord, RightsRecord, RightsService } from '../../../../src/knowledge/rights/rights.service';
import { bookId, FakeDb, USER_A } from '../support/fixtures';
import { FIXTURE_TEXT_HASH as HASH, RESEARCH_OP as OP, verifiedRecord } from '../support/rights-fixture';

function setup(opts: {
  records?: RightsRecord[];
  hash?: string | null | 'throw';
  ownership?: OwnershipAnswer | 'throw';
}) {
  const db = new FakeDb();
  db.on(/FROM book_ai_rights/, (p) => (opts.records ?? []).filter((r) => r.textHash === p[1]));
  const textIdentity = {
    currentTextHash: jest.fn(async () => {
      if (opts.hash === 'throw') throw new Error('storage down');
      return opts.hash === undefined ? HASH : opts.hash;
    }),
  };
  const ownership = {
    check: jest.fn(async () => {
      if (opts.ownership === 'throw') throw new Error('down');
      return opts.ownership ?? 'unknown';
    }),
  };
  return { svc: new RightsService(db as any, ownership as any, textIdentity as any), db, ownership };
}

describe('RightsService (default deny; ADR-006 B-4; draft PO-029)', () => {
  const B = bookId(1);

  it('an owned book with no rights record is denied (isFree is never read)', async () => {
    const { svc, db } = setup({ records: [], ownership: 'entitled' });
    expect(await svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'no_rights_record' });
    expect(db.calls.some((c) => /isFree/i.test(c.sql))).toBe(false);
  });

  it('unknown text identity denies (no production adapter)', async () => {
    const svc = new RightsService(new FakeDb() as any, new UnboundOwnershipPort(), new UnboundTextIdentityPort());
    expect(await svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'text_identity_unknown' });
  });

  it('a throwing text-identity port denies', async () => {
    expect(await setup({ hash: 'throw' }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'text_identity_unknown' });
  });

  it('a record for a stale textHash is denied', async () => {
    const { svc } = setup({ records: [verifiedRecord({ textHash: 'sha256:fixture-text-v1' })] });
    expect(await svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'no_rights_record' });
  });

  it.each(['unknown', 'pending_review', 'rejected', 'revoked', 'expired'])('status %s is denied', async (status) => {
    expect(await setup({ records: [verifiedRecord({ status })] }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'not_verified' });
  });

  it('a partial record is denied', async () => {
    expect(await setup({ records: [verifiedRecord({ jurisdiction: null })] }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'incomplete_record' });
  });

  it('an unlisted operation is denied', async () => {
    expect(await setup({ records: [verifiedRecord({ permittedOperations: ['summarization'] })] }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'operation_not_permitted' });
  });

  it('a record past its review date is denied', async () => {
    expect(await setup({ records: [verifiedRecord({ reviewDate: '2020-01-01' })] }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'review_expired' });
  });

  it('AC-11a: a verified public-domain edition is eligible WITHOUT ownership', async () => {
    const { svc, ownership } = setup({ records: [verifiedRecord()], ownership: 'not_entitled' });
    expect(await svc.eligibility(USER_A, B, OP)).toEqual({ eligible: true, basis: 'public_domain' });
    expect(ownership.check).not.toHaveBeenCalled();
  });

  describe('AC-11b: verified licensed book needs entitlement', () => {
    const licensed = verifiedRecord({ rightsBasis: 'licensed', authorDeathDate: null });
    it.each(['not_entitled', 'unknown', 'throw'] as const)('ownership %s denies', async (ownership) => {
      expect(await setup({ records: [licensed], ownership }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: false, reason: 'not_entitled' });
    });
    it('entitled is allowed', async () => {
      expect(await setup({ records: [licensed], ownership: 'entitled' }).svc.eligibility(USER_A, B, OP)).toEqual({ eligible: true, basis: 'entitlement' });
    });
  });

  describe('isCompleteRecord (07 §3)', () => {
    it('accepts a complete record', () => expect(isCompleteRecord(verifiedRecord())).toBe(true));
    it('rejects an empty array element', () => expect(isCompleteRecord(verifiedRecord({ evidenceLinks: [] }))).toBe(false));
    it('rejects a blank string element', () => expect(isCompleteRecord(verifiedRecord({ verifier: '  ' }))).toBe(false));
    it('rejects an unknown translation flag', () => expect(isCompleteRecord(verifiedRecord({ isTranslation: null }))).toBe(false));
    it('rejects a translation without translators', () => expect(isCompleteRecord(verifiedRecord({ isTranslation: true }))).toBe(false));
    it('public domain requires the author death date', () => expect(isCompleteRecord(verifiedRecord({ authorDeathDate: null }))).toBe(false));
    it('public-domain translation requires translator dates', () => {
      expect(isCompleteRecord(verifiedRecord({ isTranslation: true, translators: ['T'] }))).toBe(false);
      expect(isCompleteRecord(verifiedRecord({ isTranslation: true, translators: ['T'], translatorDeathDate: '1850-01-01', translationDate: '1830' }))).toBe(true);
    });
    it('licensed translation needs translators but not death dates', () => {
      expect(isCompleteRecord(verifiedRecord({ rightsBasis: 'licensed', authorDeathDate: null, isTranslation: true, translators: ['T'] }))).toBe(true);
    });
  });
});
