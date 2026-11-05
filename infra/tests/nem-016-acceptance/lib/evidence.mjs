// Read-only database evidence. The harness never connects to a database: it
// writes SQL, the operator runs it, and the one-line JSON result is ingested.
import { assertCardKey, assertSlug, assertUuid, STAGING } from './guard.mjs';
import { FIXTURE_TITLE } from './cases.mjs';
import { setCheck } from './state.mjs';

const TEST_EMAIL = `nem016-%@staging.invalid`;
const arr = (values, cast) => `ARRAY[${values.map((v) => `'${v}'`).join(',')}]::${cast}[]`;
const cardKey = (url) => /\/images\/([0-9a-f-]{36}\.png)$/i.exec(url ?? '')?.[1];

export function evidenceSql(state, label) {
  if (!/^[a-z0-9-]{1,32}$/.test(label)) throw new Error('Invalid evidence label');
  const shareIds = Object.values(state.shares).map((s) => assertSlug(s.id));
  const keys = [...new Set(Object.values(state.shares).map((s) => cardKey(s.imageUrl)).filter(Boolean).map(assertCardKey))];
  const dId = state.users.d?.id ? assertUuid(state.users.d.id) : '00000000-0000-0000-0000-000000000000';
  return `-- NEM-016 acceptance evidence (${label}). READ ONLY: the transaction is rolled back.
\\set ON_ERROR_STOP on
\\pset tuples_only on
\\pset format unaligned
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';
SELECT json_build_object(
  'nem016', '${label}',
  'latestMigration', (SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1),
  'schemaColumns', (SELECT count(*) FROM information_schema.columns WHERE table_name='shares' AND column_name IN ('revokedAt','configHash','quoteProvenance')),
  'outboxTable', to_regclass('card_image_deletions') IS NOT NULL,
  'shareIndexes', (SELECT count(*) FROM pg_indexes WHERE tablename='shares' AND indexname IN ('IDX_shares_createdById','UQ_shares_creator_config_live')),
  'adminIds', (SELECT coalesce(json_agg(id ORDER BY id), '[]'::json) FROM users WHERE "isAdmin"),
  'protectedRecords', (SELECT md5(coalesce((SELECT string_agg(u.id::text || coalesce(u.email, '') || u."isAdmin"::text, '|') FROM users u WHERE u.id = '${STAGING.adminId}'), '') || coalesce((SELECT string_agg(b.id::text || b.title || b."isPublished"::text || coalesce(b."uploadedById"::text, ''), '|') FROM books b WHERE b.id = '${STAGING.fixtureBookId}'), ''))),
  'fragmentsDigest', (SELECT json_build_object('count', count(*), 'md5', md5(coalesce(string_agg(f.id::text || f.text || coalesce(f.note, ''), '|' ORDER BY f.id), '')))
      FROM fragments f JOIN users u ON u.id = f."userId" WHERE u.email IS NULL OR u.email NOT LIKE '${TEST_EMAIL}'),
  'booksDigest', (SELECT json_build_object('count', count(*), 'md5', md5(coalesce(string_agg(b.id::text || b."isPublished"::text || coalesce(b."uploadedById"::text, '') || coalesce(sm."syncCoverage"::text, ''), '|' ORDER BY b.id), '')))
      FROM books b LEFT JOIN sync_maps sm ON sm."bookId" = b.id WHERE b.title <> '${FIXTURE_TITLE}'),
  'shares', (SELECT coalesce(json_agg(json_build_object(
        'id', s.id, 'createdById', s."createdById", 'fragmentId', s."fragmentId", 'revoked', s."revokedAt" IS NOT NULL,
        'configHash', s."configHash", 'source', s."quoteProvenance"->>'source',
        'shaLen', length(s."quoteProvenance"->>'sourceSha256'), 'spans', jsonb_array_length(coalesce(s."quoteProvenance"->'spans', '[]'::jsonb)))), '[]'::json)
      FROM shares s LEFT JOIN users u ON u.id = s."createdById"
      WHERE u.email LIKE '${TEST_EMAIL}' OR s.id = ANY(${arr(shareIds, 'text')})),
  'outbox', (SELECT coalesce(json_agg(json_build_object('key', d."key", 'attempts', d.attempts, 'lastError', d."lastError")), '[]'::json)
      FROM card_image_deletions d WHERE d."key" = ANY(${arr(keys, 'text')})),
  'deletedAccount', json_build_object(
      'users', (SELECT count(*) FROM users WHERE id = '${dId}'),
      'fragments', (SELECT count(*) FROM fragments WHERE "userId" = '${dId}'),
      'shares', (SELECT count(*) FROM shares WHERE "createdById" = '${dId}')),
  'testAccounts', (SELECT count(*) FROM users WHERE email LIKE '${TEST_EMAIL}'),
  'fixtureBooks', (SELECT count(*) FROM books WHERE title = '${FIXTURE_TITLE}'),
  'fixtureShareCount', (SELECT "shareCount" FROM books WHERE title = '${FIXTURE_TITLE}' LIMIT 1)
);
ROLLBACK;
`;
}

/** Takes psql output and returns the snapshot object. */
export function parseEvidence(output) {
  const line = output.split('\n').map((l) => l.trim()).find((l) => l.startsWith('{"nem016"') || l.startsWith('{"nem016" '));
  if (!line) throw new Error('No NEM-016 evidence line found in the input');
  return JSON.parse(line);
}

export function evaluateEvidence(state) {
  const { final, baseline } = state.snapshots;
  const r = state.results;
  const ran = (id) => r[id] && r[id].status !== 'BLOCKED' && r[id].status !== 'NOT RUN';
  const set = (id, problems, ok) => setCheck(state, id, problems.length ? 'FAIL' : 'PASS', problems.length ? problems.join('; ') : ok);
  const paused = state.snapshots['a11-paused'];

  if (paused && state.shares.a11) {
    const row = paused.outbox.find((d) => d.key === cardKey(state.shares.a11.imageUrl));
    const p = [];
    if (!row) p.push('no outbox row while storage was interrupted');
    else { if (!(row.attempts >= 1)) p.push(`attempts=${row.attempts}`); if (!row.lastError) p.push('lastError empty'); }
    set('A11.outbox', p, `attempts=${row?.attempts}, lastError=${row?.lastError}`);
  }
  if (!final) return;

  const rows = new Map(final.shares.map((s) => [s.id, s]));
  const known = new Set(Object.values(state.shares).map((s) => s.id));
  const unexpected = final.shares.filter((s) => !known.has(s.id));
  const uid = (role) => state.users[role]?.id;
  // A14b deletes the fixture, which now revokes all its shares (F2). Checks about
  // the live state before that use the snapshot taken just before A14b.
  const preDelete = state.snapshots['pre-a14b'] ?? final;
  const preRows = new Map(preDelete.shares.map((s) => [s.id, s]));
  const live = (hash) => preDelete.shares.filter((s) => s.configHash === hash && !s.revoked).length;
  const outboxOf = (name) => final.outbox.find((d) => d.key === cardKey(state.shares[name]?.imageUrl));
  const noUnexpected = (id) => { if (ran(`${id}.api`)) set(`${id}.db`, unexpected.length ? [`${unexpected.length} unrecorded share row(s)`] : [], 'No unexpected share rows'); };

  if (ran('A1.api')) {
    const fA = state.fragments.fA?.id;
    const n = final.shares.filter((s) => s.fragmentId === fA && s.createdById === uid('b')).length;
    set('A1.db', n ? [`${n} row(s)`] : [], 'No row');
  }
  noUnexpected('A3'); noUnexpected('A5'); noUnexpected('A7');

  const provenance = (names) => {
    const p = [];
    for (const n of names) {
      const want = state.shares[n]; const row = want && rows.get(want.id);
      if (!row) { p.push(`${n}: no row`); continue; }
      if (want.source && row.source !== want.source) p.push(`${n}: source=${row.source}`);
      if (row.shaLen !== 64) p.push(`${n}: sha length ${row.shaLen}`);
      if (want.spans && row.spans !== want.spans) p.push(`${n}: spans=${row.spans}, expected ${want.spans}`);
    }
    return p;
  };
  if (ran('A2.api')) set('A2.db', provenance(['Q1', 'Q2', 'Q3']), 'Provenance recorded');
  if (ran('A4.api')) set('A4.db', provenance(['Q4', 'Q6']), '2 spans each');
  if (ran('A19.api') && state.shares.a19) set('A19.db', provenance(['a19']), 'source=sync_map');

  // shareCount rises once per share created, so it must equal the fixture shares this
  // run created. A14b deletes the fixture, so its count comes from the snapshot before.
  const counted = final.fixtureShareCount ?? state.snapshots['pre-a14b']?.fixtureShareCount;
  const before = Number(baseline?.fixtureShareCount ?? 0);
  const onFixture = new Set(Object.values(state.fragments).filter((f) => f.bookId === state.book?.id).map((f) => f.id));
  const created = new Set(Object.entries(state.shares).filter(([n, s]) => n !== 'a14b' && onFixture.has(s.fragmentId)).map(([, s]) => s.id)).size;
  for (const [check, name] of [['A9.db', 'a9'], ['X4.db', 'x4']]) {
    const row = preRows.get(state.shares[name]?.id);
    if (!row) continue;
    const p = [];
    if (live(row.configHash) !== 1) p.push(`${live(row.configHash)} live rows`);
    if (counted === undefined || counted === null) p.push('no shareCount evidence');
    else if (Number(counted) - before !== created) p.push(`shareCount rose by ${Number(counted) - before}, created ${created}`);
    set(check, p, `One live row; shareCount matches ${created} created`);
  }
  if (ran('A10.api') && state.shares.a10) {
    const row = rows.get(state.shares.a10.id); const p = [];
    if (!row?.revoked) p.push('not revoked');
    if (outboxOf('a10')) p.push('outbox row remains');
    set('A10.db', p, 'Revoked; outbox clear');
  }
  if (r['A11.after']?.status === 'PASS' && state.shares.a11) {
    set('A11.drained', outboxOf('a11') ? ['outbox row remains'] : [], 'Outbox row gone');
  }
  if (ran('A12.fragment') && state.shares['a12-1']) {
    const p = [];
    for (const n of ['a12-1', 'a12-2']) {
      if (!rows.get(state.shares[n].id)?.revoked) p.push(`${n} not revoked`);
      if (outboxOf(n)) p.push(`${n} outbox row remains`);
    }
    set('A12.fragment.db', p, 'Both revoked; outbox clear');
  }
  if (ran('A12.account')) {
    const d = final.deletedAccount;
    set('A12.account.db', d.users || d.fragments || d.shares ? [`left: ${JSON.stringify(d)}`] : [], 'No rows left');
  }
  const schema = [];
  if (!/1748300000068|AddShareLifecycle/.test(final.latestMigration ?? '')) schema.push(`latest=${final.latestMigration}`);
  if (Number(final.schemaColumns) !== 3) schema.push(`columns=${final.schemaColumns}`);
  if (!final.outboxTable) schema.push('no outbox table');
  if (Number(final.shareIndexes) !== 2) schema.push(`indexes=${final.shareIndexes}`);
  set('A13.schema', schema, `latest=${final.latestMigration}`);

  if (ran('A15.api')) {
    const n = preDelete.shares.filter((s) => s.createdById === uid('r') && !s.revoked).length;
    set('A15.db', n === 20 ? [] : [`${n} live shares`], 'Exactly 20');
  }
  if (baseline) {
    const same = (k) => JSON.stringify(baseline[k]) === JSON.stringify(final[k]);
    set('A17.run', same('fragmentsDigest') ? [] : ['non-test fragments changed'], `${final.fragmentsDigest.count} fragments unchanged`);
    set('X6.books', same('booksDigest') ? [] : ['non-fixture books changed'], `${final.booksDigest.count} books unchanged`);
  }
  if (baseline) {
    const same = JSON.stringify(baseline.adminIds) === JSON.stringify(final.adminIds);
    set('X6.admin', same ? [] : [`admin accounts were ${baseline.adminIds.length}, now ${final.adminIds.length}`], `${final.adminIds.length} admin account(s), unchanged`);
    set('X6.protected', baseline.protectedRecords === final.protectedRecords ? [] : ['a pre-existing fixture or admin record changed'], 'Unchanged');
  }

  const x8 = Object.entries(state.shares).filter(([n]) => n.startsWith('x8-'));
  const stalled = state.snapshots['x8-stalled'];
  if (stalled && state.shares['x8-rev']) {
    const row = stalled.outbox.find((d) => d.key === cardKey(state.shares['x8-rev'].imageUrl));
    const p = [];
    if (!row) p.push('no outbox row during the stall');
    else { if (!(row.attempts >= 1)) p.push(`attempts=${row.attempts}`); if (!row.lastError) p.push('lastError empty'); }
    set('X8.outbox', p, `attempts=${row?.attempts}, lastError=${row?.lastError}; ${stalled.outbox.length} row(s) queued`);
  }
  if (r['X8.recovered']?.status === 'PASS') {
    const left = x8.filter(([n]) => outboxOf(n)).map(([n]) => n);
    set('X8.drained', left.length ? [`rows remain: ${left.join(', ')}`] : [], 'All rows gone');
  }
  if (r['X9.api'] && r['X9.api'].status !== 'BLOCKED' && state.shares['x9-1']) {
    const p = [];
    for (const n of ['x9-1', 'x9-2', 'x9-3']) {
      if (!rows.get(state.shares[n].id)?.revoked) p.push(`${n} not revoked`);
      if (outboxOf(n)) p.push(`${n} outbox row remains`);
    }
    if (preRows.get(state.shares['x9-keep']?.id)?.revoked) p.push("the other book's share was revoked");
    set('X9.db', p, 'Revoked; outbox clear; other book untouched');
  }
}

/** One-row grant or revoke for the synthetic admin. Printed only; the operator runs it. */
export function adminSql(email, grant) {
  return `-- NEM-016: ${grant ? 'GRANT' : 'REVOKE'} temporary admin on one synthetic account. DB WRITE: needs PO approval.
\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE n int;
BEGIN
  UPDATE users SET "isAdmin" = ${grant} WHERE email = '${email}' AND email LIKE '${TEST_EMAIL}';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 row, found %', n; END IF;
END $$;
COMMIT;
`;
}
