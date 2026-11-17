// G1-I1 Checkpoint IV disposable harness — HTTP client run INSIDE a disposable g1q4-* container.
//
//   node client.mjs req <url> [--host H] [--n N] [--xff V]... [--rotate PREFIX] [--timeout MS]
//       N sequential GETs (default 1). Each --xff adds a separate X-Forwarded-For header LINE (repeatable, so
//       multiple header lines can be sent); --rotate PREFIX sends "PREFIX<i>" on request i. Prints one JSON line:
//       status counts, the last status, rate-limit headers of the first/last response, and the body when N = 1.
//   node client.mjs monitor <url> [--host H] --secs S --every MS --out FILE
//       Polls for S seconds every MS ms; writes a JSON summary (counts, failure windows) to FILE inside the container.
import http from 'node:http';
import { writeFileSync } from 'node:fs';

const [mode, url, ...rest] = process.argv.slice(2);
const opt = { xff: [] };
for (let i = 0; i < rest.length; i += 2) {
  const k = rest[i].replace(/^--/, '');
  if (k === 'xff') opt.xff.push(rest[i + 1]);
  else opt[k] = rest[i + 1];
}
const timeout = Number(opt.timeout ?? 4000);

function get(i) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const headers = {};
    if (opt.host) headers.Host = opt.host;
    const xff = opt.rotate ? [`${opt.rotate}${i}`] : opt.xff;
    if (xff.length === 1) headers['X-Forwarded-For'] = xff[0];
    else if (xff.length > 1) headers['X-Forwarded-For'] = xff; // array → one header line per value
    const req = http.request({ host: u.hostname, port: u.port || 80, path: u.pathname + u.search, headers, timeout, agent: false }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', body: '', headers: {} }); });
    req.on('error', (e) => resolve({ status: `error:${e.code ?? e.name}`, body: '', headers: {} }));
    req.end();
  });
}
const rl = (r) => r && ({ limit: r.headers['x-ratelimit-limit-global'], remaining: r.headers['x-ratelimit-remaining-global'], retryAfter: r.headers['retry-after-global'] });

if (mode === 'req') {
  const n = Math.min(Math.max(Number(opt.n ?? 1), 1), 300);
  const statuses = {};
  let first; let last;
  for (let i = 1; i <= n; i++) {
    last = await get(i);
    if (i === 1) first = last;
    statuses[last.status] = (statuses[last.status] ?? 0) + 1;
  }
  console.log(JSON.stringify({ url, host: opt.host ?? null, n, xff: opt.rotate ? `rotate:${opt.rotate}` : opt.xff, statuses, last: last.status, rlFirst: rl(first), rlLast: rl(last), ...(n === 1 ? { body: last.body } : {}) }));
} else if (mode === 'monitor') {
  const end = Date.now() + Number(opt.secs) * 1000;
  const every = Number(opt.every ?? 250);
  const counts = {}; const failures = [];
  let i = 0;
  while (Date.now() < end) {
    const t = Date.now();
    const r = await get(++i);
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (r.status !== 200) failures.push({ atMs: t, status: r.status });
    const wait = every - (Date.now() - t);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  }
  const windowMs = failures.length ? failures[failures.length - 1].atMs - failures[0].atMs : 0;
  writeFileSync(opt.out, JSON.stringify({ url, host: opt.host ?? null, requests: i, counts, failures: failures.length, failureWindowMs: windowMs, firstFailure: failures[0] ?? null, lastFailure: failures[failures.length - 1] ?? null }));
} else {
  console.error('usage: node client.mjs req|monitor <url> ...');
  process.exit(2);
}
