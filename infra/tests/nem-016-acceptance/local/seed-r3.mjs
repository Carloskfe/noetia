// LOCAL ONLY. Builds one card image of each R3 class through the real API, then
// uses direct SQL on the disposable database to recreate the pre-F2 states. Never
// run this anywhere else: it deletes rows, which is why it checks the target.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSITIVE, SOURCE_SENTENCE } from '../lib/cases.mjs';
import { ApiClient } from '../lib/client.mjs';
import { readSecretSeed, resolveTarget } from '../lib/guard.mjs';
import { Ctx, uploadDisposable } from '../lib/runner.mjs';
import { loadRun, saveRun } from '../lib/state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolveTarget();
if (target.name !== 'local') throw new Error('local stack only');
const psql = (sql) => execFileSync('docker', ['compose', '-f', join(here, 'docker-compose.yml'), 'exec', '-T', 'db', 'psql', '-U', 'noetia', '-d', 'noetia_staging', '-tA', '-c', sql], { encoding: 'utf8' }).trim();
const run = loadRun(process.env.NEM016_RUN_ID);
const t = new Ctx({ client: new ApiClient(target, { minIntervalMs: 50 }), state: run.state, seed: readSecretSeed(process.env.NEM016_SECRET_FILE), log: () => {} });

let n = 0;
async function card(bookId, name) {
  const f = await t.fragment(`r3-${name}`, 'a', bookId, SOURCE_SENTENCE);
  const res = await t.share('a', f, { text: POSITIVE.Q1.text, citation: `r3-${name}-${n++}` });
  if (!t.ok(res)) throw new Error(`${name}: share returned ${res.status}`);
  return { id: res.shareId, key: res.body.imageUrl.split('/').pop() };
}
const fixture = run.state.book.id;
const out = {};

out.in_use = await card(fixture, 'in_use');
const gone = await uploadDisposable(t);
out.book_deleted = await card(gone, 'book_deleted');
psql(`DELETE FROM books WHERE id = '${gone}'`); // what deletion did before F2
out.revoked_not_deleted = await card(fixture, 'revoked');
psql(`UPDATE shares SET "revokedAt" = now() WHERE id = '${out.revoked_not_deleted.id}'`);
out.queued = await card(fixture, 'queued');
psql(`UPDATE shares SET "revokedAt" = now() WHERE id = '${out.queued.id}'`);
psql(`INSERT INTO card_image_deletions ("key") VALUES ('${out.queued.key}')`);
const hidden = await uploadDisposable(t);
out.live_book_ineligible = await card(hidden, 'ineligible');
psql(`UPDATE books SET "isPublished" = false WHERE id = '${hidden}'`);
out.unreferenced = await card(fixture, 'unreferenced');
psql(`DELETE FROM shares WHERE id = '${out.unreferenced.id}'`);
saveRun(run);
console.log(JSON.stringify(out));
