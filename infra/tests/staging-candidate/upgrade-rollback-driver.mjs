// LOCAL ONLY: API steps for upgrade-rollback-rehearsal.sh. Refuses any other target.
//   node upgrade-rollback-driver.mjs share <name>   prints the HTTP status
//   node upgrade-rollback-driver.mjs refuse         prints the status for an altered quote
//   node upgrade-rollback-driver.mjs revoke <name>  prints "<status> <ms>"
//   node upgrade-rollback-driver.mjs probe <name>   prints "<page status> <image status>"
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const lib = (f) => pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../nem-016-acceptance/lib', f)).href;
const { ApiClient } = await import(lib('client.mjs'));
const { GuardError, readSecretSeed, resolveTarget } = await import(lib('guard.mjs'));
const { NEGATIVE, POSITIVE, SOURCE_SENTENCE } = await import(lib('cases.mjs'));
const { Ctx } = await import(lib('runner.mjs'));
const { loadRun, saveRun } = await import(lib('state.mjs'));

const target = resolveTarget();
if (target.name !== 'local') throw new GuardError('This driver is for the local stack only');

const run = loadRun(process.env.NEM016_RUN_ID);
const client = new ApiClient(target, { minIntervalMs: 50 });
const t = new Ctx({ client, state: run.state, seed: readSecretSeed(process.env.NEM016_SECRET_FILE) });
const fragment = () => t.fragment('rollback', 'x', t.state.book.id, SOURCE_SENTENCE);
const [cmd, name] = process.argv.slice(2);

if (cmd === 'share') {
  const res = await t.share('x', await fragment(), { text: POSITIVE.Q1.text, citation: name }, { name });
  console.log(res.status);
} else if (cmd === 'refuse') {
  const res = await t.share('x', await fragment(), { text: NEGATIVE.N1.text });
  console.log(res.status);
} else if (cmd === 'revoke') {
  const res = await client.request('DELETE', `/shares/${t.state.shares[name].id}`, { token: await t.login('x') });
  console.log(`${res.status} ${res.ms}`);
} else if (cmd === 'probe') {
  const s = t.state.shares[name];
  const page = await t.publicShare(s.id);
  const img = await client.image(s.imageUrl);
  console.log(`${page.status} ${img.status}`);
} else {
  throw new Error(`Unknown command: ${cmd}`);
}
saveRun(run);
