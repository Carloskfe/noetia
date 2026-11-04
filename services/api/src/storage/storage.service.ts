import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

/**
 * Upper bound for one object deletion, including SDK retries. Deletions run while
 * a reader's request waits, and the S3 client has no timeout of its own, so a
 * stalled store would otherwise hold that request open indefinitely (NEM-016 F1).
 * Uploads and reads keep their current behaviour: they can legitimately be slow.
 */
export const STORAGE_DELETE_TIMEOUT_MS = 5_000;

export class StorageTimeoutError extends Error {
  constructor(message = 'storage operation timed out') {
    super(message);
    this.name = 'StorageTimeoutError';
  }
}

@Injectable()
export class StorageService {
  /** Internal client — reaches MinIO over the Docker network for uploads/reads. */
  private readonly client: S3Client;
  /** Client used only to SIGN presigned URLs, configured with the public host. */
  private readonly presignClient: S3Client;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'storage';
    const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const credentials = {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    };

    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
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
    return (await this.getBuffer(bucket, key)).toString('utf-8');
  }

  /** Reads an object through the internal client (never over a public URL). */
  async getBuffer(bucket: string, key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  /**
   * Deletes an object, or rejects with StorageTimeoutError after
   * STORAGE_DELETE_TIMEOUT_MS. The timeout also aborts the in-flight request, so
   * nothing is left running. Deleting twice is safe if the abort arrives late.
   */
  async delete(bucket: string, key: string): Promise<void> {
    const abort = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new StorageTimeoutError());
        abort.abort();
      }, STORAGE_DELETE_TIMEOUT_MS);
    });
    const send = this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: abort.signal,
    });
    try {
      // race() also handles the loser, so a late abort rejection stays handled.
      await Promise.race([send, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Returns a permanent public URL — requires the bucket to allow public reads (set in prod). */
  publicUrl(bucket: string, key: string): string {
    const base = process.env.MINIO_PUBLIC_URL ?? `http://storage:9000`;
    return `${base}/${bucket}/${key}`;
  }
}
