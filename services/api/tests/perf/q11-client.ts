/**
 * NEM-024 Checkpoint E — Q-11 reader-interference CLIENT (runs on the host, outside the CPU/memory cap, so client work
 * never competes with the measured server). Sequential (concurrency 1) keep-alive requests; ≥ 1,000 per endpoint per
 * condition; per-endpoint p50/p95/p99/max; condition = idle or a research scenario at the guard limit.
 *
 * Usage: node q11-client.js <W> <scenario,...> <out.json> [container-name]
 */
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { Agent, request } from 'http';

const [W, scenarioArg, outFile, container] = process.argv.slice(2);
const BASE = process.env.HARNESS_URL ?? 'http://127.0.0.1:4100';
const CONTROL = process.env.CONTROL_URL ?? 'http://127.0.0.1:4101';
const N = Number(process.env.Q11_N ?? 1000);
const agent = new Agent({ keepAlive: true, maxSockets: 1 });
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let socketRetries = 0;
/** A request on a keep-alive socket the server already closed (idle > keepAliveTimeout) is retried ONCE on a fresh
 * socket; only the successful attempt's latency is recorded; retries are counted in the output. */
async function get(url: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; body: string; ms: number }> {
  try {
    return await getOnce(url, headers, method);
  } catch (e) {
    if (!/ECONNRESET|socket hang up|EPIPE/.test((e as Error).message)) throw e;
    socketRetries++;
    return getOnce(url, headers, method);
  }
}
function getOnce(url: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; body: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = request(url, { method, agent, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
    });
    req.on('error', reject);
    req.end();
  });
}
const control = async (path: string, method = 'POST') => JSON.parse((await get(`${CONTROL}${path}`, {}, method)).body);

function dockerStats(): { cpu: number; memMb: number } | null {
  if (!container) return null;
  try {
    const out = execFileSync('docker', ['stats', '--no-stream', '--format', '{{.CPUPerc}};{{.MemUsage}}', container], { encoding: 'utf8' }).trim();
    const [cpu, mem] = out.split(';');
    const m = /([\d.]+)\s*(MiB|GiB|KiB)/.exec(mem)!;
    const memMb = Number(m[1]) * (m[2] === 'GiB' ? 1024 : m[2] === 'KiB' ? 1 / 1024 : 1);
    return { cpu: Number(cpu.replace('%', '')), memMb };
  } catch {
    return null;
  }
}

async function measure(label: string, ready: { readerBookId: string; readerToken: string }) {
  const auth = { Authorization: `Bearer ${ready.readerToken}` };
  const endpoints: [string, string, Record<string, string>][] = [
    ['GET /books', `${BASE}/books`, {}],
    ['GET /books/:id', `${BASE}/books/${ready.readerBookId}`, auth],
    ['GET /books/:id/sync-map', `${BASE}/books/${ready.readerBookId}/sync-map`, auth],
  ];
  const result: Record<string, unknown> = {};
  const docker: { cpu: number; memMb: number }[] = [];
  let sampling = true;
  const sampler = (async () => { while (sampling) { const s = dockerStats(); if (s) docker.push(s); await sleep(2000); } })();
  for (const [name, url, headers] of endpoints) {
    for (let i = 0; i < 20; i++) await get(url, headers); // warm-up
    const lat: number[] = [];
    const statuses: Record<number, number> = {};
    for (let i = 0; i < N; i++) {
      const r = await get(url, headers);
      lat.push(r.ms);
      statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    }
    result[name] = { n: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: Math.max(...lat), statuses };
  }
  sampling = false;
  await sampler;
  return { label, endpoints: result, docker: docker.length ? { cpuMax: Math.max(...docker.map((d) => d.cpu)), cpuAvg: docker.reduce((a, d) => a + d.cpu, 0) / docker.length, memMaxMb: Math.max(...docker.map((d) => d.memMb)), samples: docker.length } : null };
}

async function main() {
  let ready: { readerBookId: string; readerToken: string; W: number } | null = null;
  for (let i = 0; i < 120 && !ready; i++) { try { ready = await control('/ready', 'GET'); } catch { await sleep(1000); } }
  if (!ready) throw new Error('harness not ready');
  const runs: unknown[] = [];
  await control('/reset');
  const idle = await measure('idle', ready);
  runs.push({ ...idle, server: await control('/stats', 'GET') });
  for (const sc of scenarioArg.split(',').filter(Boolean)) {
    if (sc === 'probe10') { runs.push({ label: 'probe10', probe: await control('/probe10') }); continue; }
    await control('/reset');
    await control(`/load?scenario=${sc}`);
    await sleep(3000); // reach steady state
    const m = await measure(sc, ready);
    const server = await control('/stop');
    runs.push({ ...m, server });
    writeFileSync(outFile, JSON.stringify({ W: Number(W), partial: true, runs, socketRetries }, null, 1));
  }
  const out = { W: Number(W), harnessW: ready.W, n: N, at: new Date().toISOString(), socketRetries, runs };
  writeFileSync(outFile, JSON.stringify(out, null, 1));
  process.stdout.write(`Q11_DONE ${outFile}\n`);
  agent.destroy();
}
main().catch((e) => { process.stderr.write(`${(e as Error).stack}\n`); process.exit(1); });
