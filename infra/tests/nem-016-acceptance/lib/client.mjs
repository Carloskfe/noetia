// HTTP client: every request passes the guard, follows no redirects, is paced so
// the host's shared 120/min throttler isn't exhausted, and never stores tokens.
import { assertImageUrl, assertRoute, GuardError } from './guard.mjs';

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

export class ApiClient {
  constructor(target, { fetchImpl = globalThis.fetch, sleep = sleepDefault, minIntervalMs = 700, throttleWaitMs = 65_000, timeoutMs = 45_000 } = {}) {
    Object.assign(this, { target, fetchImpl, sleep, minIntervalMs, throttleWaitMs, timeoutMs, last: 0, deletableBookIds: [] });
  }

  async pace() {
    const wait = this.last + this.minIntervalMs - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.last = Date.now();
  }

  async raw(url, init, timeoutMs) {
    const started = Date.now();
    try {
      const res = await this.fetchImpl(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs) });
      return { res, ms: Date.now() - started };
    } catch (err) {
      if (err instanceof GuardError) throw err;
      return { res: null, ms: Date.now() - started, netError: err?.name ?? 'Error' };
    }
  }

  /** Returns { status, body, ms, date, netError }; status 0 means no HTTP response. */
  async request(method, path, { token, json, form, fixtureUpload = false, timeoutMs } = {}) {
    assertRoute(method, path, { fixtureUpload, deletableBookIds: this.deletableBookIds, protectBooks: this.target.name === 'staging' });
    const headers = { 'x-client-type': 'mobile', accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    let body;
    if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;

    for (let attempt = 0; ; attempt++) {
      await this.pace();
      const { res, ms, netError } = await this.raw(`${this.target.api}${path}`, { method, headers, body }, timeoutMs);
      if (!res) return { status: 0, body: null, ms, netError };
      const text = await res.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
      // A throttler 429 (host-wide) isn't the per-user limit A15 measures: wait and retry.
      if (res.status === 429 && parsed?.error !== 'rate_limited' && attempt < 2) {
        await this.sleep(this.throttleWaitMs);
        continue;
      }
      return { status: res.status, body: parsed, ms, date: res.headers.get('date') };
    }
  }

  async image(url) {
    assertImageUrl(this.target, url);
    await this.pace();
    const { res, netError } = await this.raw(url, { method: 'GET' });
    if (!res) return { status: 0, netError };
    const bytes = new Uint8Array(await res.arrayBuffer());
    const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    return { status: res.status, png, size: bytes.length };
  }
}
