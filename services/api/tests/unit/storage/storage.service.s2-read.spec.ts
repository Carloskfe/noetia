import { readFileSync } from 'fs';
import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from 'http';
import { Agent as HttpsAgent, createServer as createHttpsServer } from 'https';
import { AddressInfo, createServer as createNetServer, Server as NetServer, Socket } from 'net';
import { join } from 'path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S2_MAX_OBJECT_BYTES, S2ReadError, StorageService } from '../../../src/storage/storage.service';

/**
 * PO-047 Component A — `StorageService.getBytesExact` (S2 exact-byte read).
 *
 * Every test talks to an in-process loopback server (no external network). `getSignedUrl` is replaced by a stub
 * that returns a URL on the configured endpoint with a fake signature, so the transport, validation and failure
 * semantics are exercised against real sockets. Real SigV4 signing against MinIO is covered by the integration suite.
 */
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
const sign = getSignedUrl as jest.Mock;
const FIX = join(__dirname, 'fixtures');
const SECRET = 'X-Amz-Signature=deadbeefsecret';
const ENV = { ...process.env };

class FastStorage extends StorageService {
  constructor(idle = 300, total = 1_500, private readonly ca?: Buffer) {
    super();
    this.s2IdleTimeoutMs = idle;
    this.s2TotalTimeoutMs = total;
  }
  protected createS2Agent(protocol: 'http:' | 'https:') {
    return this.ca && protocol === 'https:' ? new HttpsAgent({ keepAlive: true, ca: this.ca }) : super.createS2Agent(protocol);
  }
}

const servers: (Server | NetServer)[] = [];
const sockets = new Set<Socket>();
afterEach(async () => {
  process.env = { ...ENV };
  for (const s of sockets) s.destroy();
  sockets.clear();
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(() => r(undefined)))));
  sign.mockReset();
});
const track = <T extends Server | NetServer>(s: T) => { servers.push(s); s.on('connection', (c: Socket) => { sockets.add(c); c.on('close', () => sockets.delete(c)); }); return s; };
const listen = (s: Server | NetServer) => new Promise<number>((r) => s.listen(0, '127.0.0.1', () => r((s.address() as AddressInfo).port)));

/** Configure the service for an endpoint, and make `getSignedUrl` return a URL on it (or on `origin`). */
function configure(port: number, opts: { ssl?: boolean; origin?: string } = {}) {
  process.env.MINIO_ENDPOINT = '127.0.0.1';
  process.env.MINIO_PORT = String(port);
  process.env.MINIO_USE_SSL = opts.ssl ? 'true' : 'false';
  sign.mockImplementation(async (_c: unknown, cmd: { input: { Bucket: string; Key: string } }) =>
    `${opts.origin ?? `${opts.ssl ? 'https' : 'http'}://127.0.0.1:${port}`}/${cmd.input.Bucket}/${cmd.input.Key}?${SECRET}`);
}
async function httpObject(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const s = track(createHttpServer(handler));
  configure(await listen(s));
  return s;
}
/** Raw TCP server: replies to each request with `reply(requestIndexOnConnection)`; `null` closes the socket. */
async function rawObject(reply: (n: number, sock: Socket) => Buffer | string | null | void) {
  const s = track(createNetServer((sock) => {
    let n = 0;
    let acc = '';
    sock.on('data', (d) => {
      acc += d.toString('latin1');
      while (acc.includes('\r\n\r\n')) {
        acc = acc.slice(acc.indexOf('\r\n\r\n') + 4);
        const out = reply(n++, sock);
        if (out === null) sock.destroy();
        else if (out !== undefined) sock.write(out);
      }
    });
  }));
  configure(await listen(s));
  return s;
}
const send200 = (body: Buffer) => (_req: IncomingMessage, res: ServerResponse) => { res.writeHead(200, { 'content-length': body.length }); res.end(body); };
async function expectFail(p: Promise<unknown>, reasons: string[]) {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(S2ReadError);
  expect(reasons).toContain((e as S2ReadError).reason);
  expect(String((e as Error).message)).not.toMatch(/deadbeef|Signature|127\.0\.0\.1|books\/|texts\//); // no URL, key or signature
  return e as S2ReadError;
}
const TEXTS = {
  spanish: Buffer.from('Érase una vez un niño; ¿cantaba? ¡Sí! Ñandú, pingüino, acción.'),
  combining: Buffer.from('é ñ ä — ộ'),
  emoji: Buffer.from('😀👍🏽 𝔘na 👨‍👩‍👧 \u{10FFFF}'),
  bom: Buffer.from('﻿Hola﻿mundo'),
  crlf: Buffer.from('uno\r\ndos\rtres\n'),
  empty: Buffer.alloc(0),
};

describe('StorageService.getBytesExact — successful reads (PO-047)', () => {
  it.each(Object.entries(TEXTS))('returns the exact bytes (%s) in one owned, unpooled buffer; asks for identity encoding', async (_n, body) => {
    let headers: IncomingMessage['headers'] = {};
    await httpObject((req, res) => { headers = req.headers; send200(body)(req, res); });
    const out = await new FastStorage().getBytesExact('texts/a.txt');
    expect(out.equals(body)).toBe(true);
    expect(headers['accept-encoding']).toBe('identity');
    if (out.length) {
      expect(out.byteOffset).toBe(0);
      expect(out.byteLength).toBe(out.buffer.byteLength); // whole ArrayBuffer: transferable, never a pool slice
    }
  });

  it('multi-megabyte object (3 MB, mixed scripts) arrives byte-exact', async () => {
    const big = Buffer.from('Érase 😀 canción \r\n'.repeat(140_000));
    expect(big.length).toBeGreaterThan(3_000_000);
    await httpObject(send200(big));
    expect((await new FastStorage(2_000, 10_000).getBytesExact('k')).equals(big)).toBe(true);
  });

  it('signs with the private client for the requested bucket/key, and requests exactly that object', async () => {
    let path = '';
    await httpObject((req, res) => { path = req.url ?? ''; send200(TEXTS.spanish)(req, res); });
    await new FastStorage().getBytesExact('texts/b.txt', 'books');
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign.mock.calls[0][1].input).toEqual({ Bucket: 'books', Key: 'texts/b.txt' });
    expect(sign.mock.calls[0][2]).toEqual({ expiresIn: 60 });
    expect(path.startsWith('/books/texts/b.txt?')).toBe(true);
  });

  it('concurrent reads return independent, exact buffers', async () => {
    const bodies = Array.from({ length: 10 }, (_, i) => Buffer.from(`libro ${i} — ${'ñ'.repeat(5_000 + i)}`));
    await httpObject((req, res) => send200(bodies[Number(/k(\d+)/.exec(req.url ?? '')![1])])(req, res));
    const svc = new FastStorage();
    const out = await Promise.all(bodies.map((_, i) => svc.getBytesExact(`k${i}`)));
    out.forEach((b, i) => expect(b.equals(bodies[i])).toBe(true));
    expect(new Set(out.map((b) => b.buffer)).size).toBe(10);
  });

  it('HTTPS endpoint: uses TLS (trusted test CA via the test-only agent seam) and returns exact bytes', async () => {
    const s = track(createHttpsServer({ key: readFileSync(join(FIX, 'server.key')), cert: readFileSync(join(FIX, 'server.pem')) }, send200(TEXTS.emoji)));
    configure(await listen(s), { ssl: true });
    const out = await new FastStorage(300, 1_500, readFileSync(join(FIX, 'ca.pem'))).getBytesExact('k');
    expect(out.equals(TEXTS.emoji)).toBe(true);
  });

  it('one retry only for a reset on a REUSED keep-alive socket before any response', async () => {
    let requests = 0;
    await rawObject((n) => {
      requests++;
      if (n === 0) return `HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: keep-alive\r\n\r\nabc`;
      return null; // second request on the same socket: drop the connection without a response
    });
    const svc = new FastStorage();
    expect((await svc.getBytesExact('k')).toString()).toBe('abc');
    expect((await svc.getBytesExact('k')).toString()).toBe('abc'); // reused socket reset → retried once on a new socket
    expect(requests).toBe(3);
  });
});

describe('StorageService.getBytesExact — fail closed (S2ReadError → unavailable)', () => {
  it('signing failure → sign; no request is made', async () => {
    let hit = false;
    await httpObject((req, res) => { hit = true; send200(TEXTS.spanish)(req, res); });
    sign.mockRejectedValue(new Error('no credentials'));
    await expectFail(new FastStorage().getBytesExact('k'), ['sign']);
    expect(hit).toBe(false);
  });

  it('a signed URL outside the configured private origin (or a non-HTTP scheme) → destination; no request', async () => {
    let hit = false;
    const s = track(createHttpServer((req, res) => { hit = true; send200(TEXTS.spanish)(req, res); }));
    const port = await listen(s);
    configure(port, { origin: `http://localhost:${port}` }); // different origin than the configured 127.0.0.1
    await expectFail(new FastStorage().getBytesExact('k'), ['destination']);
    configure(port, { origin: `https://127.0.0.1:${port}` }); // scheme differs from configuration
    await expectFail(new FastStorage().getBytesExact('k'), ['destination']);
    configure(port, { origin: 'file://' });
    await expectFail(new FastStorage().getBytesExact('k'), ['destination']);
    expect(hit).toBe(false);
  });

  it.each([403, 404, 500, 503])('HTTP %i (expired signature, missing object, server error) → status', async (code) => {
    await httpObject((_req, res) => { res.writeHead(code, { 'content-length': 2 }); res.end('no'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['status']);
  });

  it('redirects are never followed → status; the redirect target is never contacted', async () => {
    let targetHit = false;
    const target = track(createHttpServer((req, res) => { targetHit = true; send200(TEXTS.spanish)(req, res); }));
    const tport = await listen(target);
    await httpObject((_req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${tport}/evil`, 'content-length': 0 }); res.end(); });
    await expectFail(new FastStorage().getBytesExact('k'), ['status']);
    expect(targetHit).toBe(false);
  });

  it('partial content (206 / Content-Range) → status', async () => {
    await httpObject((_req, res) => { res.writeHead(206, { 'content-length': 3, 'content-range': 'bytes 0-2/10' }); res.end('abc'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['status']);
    await httpObject((_req, res) => { res.writeHead(200, { 'content-length': 3, 'content-range': 'bytes 0-2/3' }); res.end('abc'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['status']);
  });

  it('non-identity content encoding → encoding', async () => {
    await httpObject((_req, res) => { res.writeHead(200, { 'content-length': 3, 'content-encoding': 'gzip' }); res.end('abc'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['encoding']);
  });

  it('missing Content-Length (chunked) → length', async () => {
    await httpObject((_req, res) => { res.writeHead(200, { 'transfer-encoding': 'chunked' }); res.write('ab'); res.end('c'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['length']);
  });

  it.each([['abc'], ['-1'], ['1.5'], ['1e3'], [' 12'], ['9999999999999999']])('malformed Content-Length %p → length or transport (parser rejects)', async (cl) => {
    await rawObject(() => `HTTP/1.1 200 OK\r\nContent-Length: ${cl}\r\nConnection: close\r\n\r\nabc`);
    await expectFail(new FastStorage().getBytesExact('k'), ['length', 'transport', 'truncated', 'timeout']); // ' 12' is valid OWS → waits for missing bytes
  });

  it('announced length above the accepted object bound → length, before any allocation', async () => {
    const alloc = jest.spyOn(Buffer, 'alloc');
    await rawObject(() => `HTTP/1.1 200 OK\r\nContent-Length: ${S2_MAX_OBJECT_BYTES + 1}\r\nConnection: close\r\n\r\nabc`);
    await expectFail(new FastStorage().getBytesExact('k'), ['length']);
    expect(alloc).not.toHaveBeenCalledWith(S2_MAX_OBJECT_BYTES + 1);
    alloc.mockRestore();
  });

  it('allocation failure → alloc', async () => {
    await httpObject(send200(TEXTS.spanish));
    const alloc = jest.spyOn(Buffer, 'alloc').mockImplementationOnce(() => { throw new RangeError('Array buffer allocation failed'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['alloc']);
    alloc.mockRestore();
  });

  it('announced length larger than the body, then close → truncated (never partial bytes)', async () => {
    await rawObject((_n, sock) => { sock.end('HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\nabc'); });
    await expectFail(new FastStorage().getBytesExact('k'), ['truncated']);
  });

  it('premature connection close mid-body → truncated', async () => {
    await rawObject((_n, sock) => { sock.write('HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\npartial'); setTimeout(() => sock.destroy(), 20); });
    await expectFail(new FastStorage().getBytesExact('k'), ['truncated']);
  });

  it('body stalls (idle timeout) → timeout', async () => {
    await rawObject((_n, sock) => { sock.write('HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\nslow'); });
    await expectFail(new FastStorage(150, 5_000).getBytesExact('k'), ['timeout']);
  });

  it('slow trickle beyond the total deadline → timeout', async () => {
    await rawObject((_n, sock) => {
      sock.write('HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n');
      const t = setInterval(() => (sock.destroyed ? clearInterval(t) : sock.write('x')), 50);
    });
    await expectFail(new FastStorage(500, 400).getBytesExact('k'), ['timeout']);
  });

  it('no response at all (server accepts, never answers) → timeout', async () => {
    await rawObject(() => undefined);
    await expectFail(new FastStorage(150, 5_000).getBytesExact('k'), ['timeout']);
  });

  it('connection refused → transport (no retry on a fresh socket)', async () => {
    const s = track(createHttpServer());
    const port = await listen(s);
    await new Promise((r) => s.close(r));
    servers.pop();
    configure(port);
    await expectFail(new FastStorage().getBytesExact('k'), ['transport']);
  });

  it('TLS that fails verification (self-signed) with the production agent → tls', async () => {
    const s = track(createHttpsServer({ key: readFileSync(join(FIX, 'selfsigned.key')), cert: readFileSync(join(FIX, 'selfsigned.pem')) }, send200(TEXTS.spanish)));
    configure(await listen(s), { ssl: true });
    await expectFail(new FastStorage().getBytesExact('k'), ['tls']);
  });

  it('body larger than announced: only the framed bytes are ever accepted; extra bytes never enter the buffer', async () => {
    // HTTP/1.1 framing ends the body at Content-Length; trailing garbage belongs to no response. The buffer holds
    // exactly the announced bytes, which the S2 worker then hash-verifies (a mismatch can never be served).
    await rawObject(() => 'HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nabcEXTRA-BYTES');
    const r = await new FastStorage().getBytesExact('k').then((b) => b.toString(), (e) => e);
    if (typeof r === 'string') expect(r).toBe('abc');
    else expect(r).toBeInstanceOf(S2ReadError);
  });
});

describe('StorageService.getBytesExact — the presigned URL never escapes', () => {
  it('neither successful nor failed reads surface the URL; errors carry fixed reason labels only', async () => {
    await httpObject((_req, res) => { res.writeHead(403, { 'content-length': 0 }); res.end(); });
    const e = await expectFail(new FastStorage().getBytesExact('texts/secret-key.txt'), ['status']);
    expect(Object.keys(e).sort()).toEqual(['name', 'reason']);
    expect(JSON.stringify(e)).not.toMatch(/secret-key|deadbeef/);
  });
});
