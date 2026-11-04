// Run state: ids and results only, kept outside the repository. No secrets.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { assertOutsideRepo, redact } from './guard.mjs';
import { allChecks, STATUSES } from './matrix.mjs';

export const stateRoot = (env = process.env) => env.NEM016_STATE_DIR ?? join(homedir(), '.local', 'state', 'noetia-nem016');

export function loadRun(runId, env = process.env) {
  if (!/^[a-z0-9]{6,16}$/.test(runId ?? '')) throw new Error('NEM016_RUN_ID is missing or invalid');
  const dir = join(stateRoot(env), runId);
  assertOutsideRepo(dir, 'state directory');
  const file = join(dir, 'state.json');
  const state = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : { runId, users: {}, fragments: {}, shares: {}, book: null, results: {}, snapshots: {}, a11: {} };
  return { dir, file, state };
}

export function saveRun({ dir, file, state }) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

const KNOWN = new Set(allChecks().map((c) => c.id));

export function setCheck(state, id, status, detail = '') {
  if (!KNOWN.has(id)) throw new Error(`Unknown check id: ${id}`);
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  state.results[id] = { status, detail: redact(detail).slice(0, 600), at: new Date().toISOString() };
}

/** Merges operator and manual results, which must say what was seen. */
export function mergeManual(state, entries) {
  const kinds = new Map(allChecks().map((c) => [c.id, c.kind]));
  for (const [id, entry] of Object.entries(entries)) {
    const kind = kinds.get(id);
    if (!kind) throw new Error(`Unknown check id: ${id}`);
    if (kind !== 'manual' && kind !== 'operator') throw new Error(`${id} is a ${kind} check and can't be set by hand`);
    if (!STATUSES.includes(entry.status)) throw new Error(`${id}: unknown status ${entry.status}`);
    if (entry.status === 'NOT RUN') continue;
    if (!entry.evidence?.trim()) throw new Error(`${id}: ${entry.status} needs an evidence note`);
    setCheck(state, id, entry.status, entry.evidence);
  }
}
