import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Agent as HttpAgent, IncomingMessage, request as httpRequest } from 'http';
import { Agent as HttpsAgent, request as httpsRequest } from 'https';
import { Readable } from 'stream';

/**
 * PO-047 — bounds for the S2 exact-byte object read (`getBytesExact`).
 * The size bound is the existing, enforced book-upload limit (`books.controller.ts`: 500 MB per uploaded file); it is
 * not a new product limit. Timeouts bound the read; the presigned URL is short-lived and never leaves this class.
 */
export const S2_MAX_OBJECT_BYTES = 500 * 1024 * 1024;
export const S2_READ_IDLE_TIMEOUT_MS = 5_000;
export const S2_READ_TOTAL_TIMEOUT_MS = 15_000;
export const S2_PRESIGN_TTL_SECONDS = 60;

export type S2ReadFailure =
  | 'sign' | 'destination' | 'transport' | 'tls' | 'timeout' | 'status' | 'length' | 'encoding' | 'alloc' | 'overflow' | 'truncated';

/** A failed S2 read. Carries a fixed reason label only: never a URL, key, header, credential or content. */
export class S2ReadError extends Error {
  constructor(readonly reason: S2ReadFailure) {
    super(`s2_read_failed:${reason}`);
    this.name = 'S2ReadError';
  }
}

const TLS_ERROR = /CERT|SELF_SIGNED|ERR_TLS|ERR_SSL|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER|HOSTNAME|ALTNAME/;

@Injectable()
export class StorageService {
  /** Internal client — reaches MinIO over the Docker network for uploads/reads. */
  private readonly client: S3Client;
  /** Client used only to SIGN presigned URLs, configured with the public host. */
  private readonly presignClient: S3Client;
  /** PO-047: the only origin an S2 exact read may contact (the configured private endpoint). */
  private readonly internalOrigin: string;
  private s2Agents: { 'http:'?: HttpAgent; 'https:'?: HttpsAgent } = {};
  /** S2 read timeouts (production values; a test subclass may shorten them). */
  protected s2IdleTimeoutMs = S2_READ_IDLE_TIMEOUT_MS;
  protected s2TotalTimeoutMs = S2_READ_TOTAL_TIMEOUT_MS;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'storage';
    const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const credentials = {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    };

    const internalEndpoint = `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`;
    this.internalOrigin = new URL(internalEndpoint).origin;
    this.client = new S3Client({
      endpoint: internalEndpoint,
      region: 'us-east-1',
      credentials,
      forcePathStyle: true,
    });

    // Presigned URLs are fetched by browsers at the PUBLIC host, so they must be
    // SIGNED against that host. SigV4 signs the Host header, so signing against the
    // internal host and string-rewriting it afterwards invalidates the signature —
    // MinIO (≥ 2025 releases) rejects it with SignatureDoesNotMatch, breaking every
    // presigned audio/text URL. Presigning is offline (no network call), so signing
    // with the public endpoint here is safe even though the api reaches MinIO
    // internally for real uploads/reads.
    const publicBase = process.env.MINIO_PUBLIC_URL;
    this.presignClient = publicBase
      ? new S3Client({ endpoint: publicBase, region: 'us-east-1', credentials, forcePathStyle: true })
      : this.client;
  }

  async upload(bucket: string, key: string, buffer: Buffer, mimetype: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimetype }),
    );
  }

  async presign(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    // Sign with the public-host client so the signed Host matches what the browser
    // requests (no post-sign host rewrite — that breaks the SigV4 signature).
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.presignClient, command, { expiresIn: ttlSeconds });
  }

  async getText(key: string, bucket = 'books'): Promise<string> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf-8');
  }

  /**
   * Exact object bytes (no decoding). NEM-023: the book text identity hash is byte-exact, so it cannot be computed
   * from `getText`'s decoded string.
   */
  async getBytes(key: string, bucket = 'books'): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  /**
   * PO-047 — S2 exact-byte object read (used by the S2 adapter only; `getBytes` is unchanged for its accepted callers).
   *
   * The object is fetched with a GET presigned **internally** with the private client (never the public presign
   * client) and constrained to the configured private origin. The body is copied into ONE zero-filled buffer whose
   * size is the validated `Content-Length`; no chunk list, no concatenation. It resolves only after exactly that many
   * bytes arrived on a 200 response with identity encoding; every other outcome rejects with `S2ReadError` (the S2
   * caller maps it to `unavailable`). Integrity is still decided downstream by the per-request SHA-256 and strict UTF-8
   * checks in the S2 worker. TLS verification uses Node's defaults; redirects are never followed (any non-200 fails).
   * One retry is made only for a reset on a reused keep-alive socket before any response (Node's documented race).
   */
  async getBytesExact(key: string, bucket = 'books'): Promise<Buffer> {
    let url: URL;
    try {
      url = new URL(await getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: S2_PRESIGN_TTL_SECONDS }));
    } catch {
      throw new S2ReadError('sign');
    }
    if (url.origin !== this.internalOrigin || (url.protocol !== 'http:' && url.protocol !== 'https:')) throw new S2ReadError('destination');
    const deadline = Date.now() + this.s2TotalTimeoutMs;
    try {
      return await this.readExact(url, deadline);
    } catch (e) {
      if ((e as { retryable?: boolean }).retryable && Date.now() < deadline) return this.readExact(url, deadline);
      throw e instanceof S2ReadError ? e : new S2ReadError('transport');
    }
  }

  /** Keep-alive agent per protocol for S2 reads (overridable in tests to trust a test CA; production uses defaults). */
  protected createS2Agent(protocol: 'http:' | 'https:'): HttpAgent | HttpsAgent {
    return protocol === 'https:' ? new HttpsAgent({ keepAlive: true, maxSockets: 16 }) : new HttpAgent({ keepAlive: true, maxSockets: 16 });
  }

  private s2Agent(protocol: 'http:' | 'https:'): HttpAgent | HttpsAgent {
    return (this.s2Agents[protocol] ??= this.createS2Agent(protocol) as never);
  }

  private readExact(url: URL, deadline: number): Promise<Buffer> {
    const protocol = url.protocol as 'http:' | 'https:';
    return new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      let res: IncomingMessage | undefined;
      const finish = (err: (S2ReadError & { retryable?: boolean }) | null, value?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(total);
        if (err) {
          res?.destroy();
          req.destroy();
          reject(err);
        } else resolve(value!);
      };
      const fail = (reason: S2ReadFailure) => finish(new S2ReadError(reason));
      const total = setTimeout(() => fail('timeout'), Math.max(0, deadline - Date.now()));
      const send = protocol === 'https:' ? httpsRequest : httpRequest;
      const req = send(url, { method: 'GET', agent: this.s2Agent(protocol), timeout: this.s2IdleTimeoutMs, headers: { 'accept-encoding': 'identity' } }, (r) => {
        res = r;
        if (r.statusCode !== 200 || r.headers['content-range'] !== undefined) return fail('status');
        const enc = r.headers['content-encoding'];
        if (enc !== undefined && enc !== 'identity') return fail('encoding');
        const cl = r.headers['content-length'];
        if (typeof cl !== 'string' || !/^\d{1,15}$/.test(cl)) return fail('length');
        const len = Number(cl);
        if (!Number.isSafeInteger(len) || len > S2_MAX_OBJECT_BYTES) return fail('length');
        let buf: Buffer;
        try {
          buf = Buffer.alloc(len); // zero-filled, unpooled, owned: never exposes uninitialized memory
        } catch {
          return fail('alloc');
        }
        let off = 0;
        r.on('data', (c: Buffer) => {
          if (settled) return;
          if (off + c.length > len) return fail('overflow');
          c.copy(buf, off);
          off += c.length;
        });
        r.on('end', () => (r.complete && off === len ? finish(null, buf) : fail('truncated')));
        r.on('aborted', () => fail('truncated'));
        r.on('error', () => fail('truncated'));
        r.on('close', () => fail('truncated')); // no-op once settled
      });
      req.on('timeout', () => fail('timeout'));
      req.on('error', (e: NodeJS.ErrnoException) => {
        if (res) return fail('truncated');
        if (TLS_ERROR.test(e.code ?? '')) return fail('tls');
        const err: S2ReadError & { retryable?: boolean } = new S2ReadError('transport');
        err.retryable = req.reusedSocket && (e.code === 'ECONNRESET' || e.code === 'EPIPE');
        finish(err);
      });
      req.end();
    });
  }

  /** Returns a permanent public URL — requires the bucket to allow public reads (set in prod). */
  publicUrl(bucket: string, key: string): string {
    const base = process.env.MINIO_PUBLIC_URL ?? `http://storage:9000`;
    return `${base}/${bucket}/${key}`;
  }
}
