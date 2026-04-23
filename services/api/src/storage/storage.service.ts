import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'storage';
    const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
    const useSsl = process.env.MINIO_USE_SSL === 'true';

    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async upload(bucket: string, key: string, buffer: Buffer, mimetype: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimetype }),
    );
  }

  async presign(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }
}
