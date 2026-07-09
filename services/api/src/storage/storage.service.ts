import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

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
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf-8');
  }

  /** Returns a permanent public URL — requires the bucket to allow public reads (set in prod). */
  publicUrl(bucket: string, key: string): string {
    const base = process.env.MINIO_PUBLIC_URL ?? `http://storage:9000`;
    return `${base}/${bucket}/${key}`;
  }
}
