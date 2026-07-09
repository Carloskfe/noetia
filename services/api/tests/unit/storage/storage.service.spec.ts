import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from '../../../src/storage/storage.service';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('StorageService', () => {
  let service: StorageService;
  const mockSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));
    service = new StorageService();
  });

  describe('constructor', () => {
    it('creates an S3Client with forcePathStyle for MinIO compatibility', () => {
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({ forcePathStyle: true }),
      );
    });
  });

  describe('upload', () => {
    it('sends a PutObjectCommand with the correct bucket, key, body, and content-type', async () => {
      mockSend.mockResolvedValue({});
      const buffer = Buffer.from('file content');
      await service.upload('books', 'texts/book.html', buffer, 'text/html');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'books',
        Key: 'texts/book.html',
        Body: buffer,
        ContentType: 'text/html',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('propagates S3 errors to the caller', async () => {
      mockSend.mockRejectedValue(new Error('S3 unavailable'));
      await expect(
        service.upload('books', 'k', Buffer.from(''), 'text/plain'),
      ).rejects.toThrow('S3 unavailable');
    });
  });

  describe('presign', () => {
    it('returns the signed URL from getSignedUrl', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.local/books/key?sig=abc');
      const url = await service.presign('books', 'texts/book.html', 3600);
      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'books', Key: 'texts/book.html' });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
      expect(url).toBe('https://minio.local/books/key?sig=abc');
    });

    it('respects the ttlSeconds parameter', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.url');
      await service.presign('audio', 'audio/book.mp3', 7200);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 7200 },
      );
    });
  });

  // Regression: presigned URLs must be SIGNED against the public host, not signed
  // internally then host-rewritten (that invalidates the SigV4 signature → MinIO
  // returns SignatureDoesNotMatch and all audio/text URLs 403).
  describe('presign — public-host signing', () => {
    const OLD = process.env.MINIO_PUBLIC_URL;
    afterEach(() => {
      if (OLD === undefined) delete process.env.MINIO_PUBLIC_URL;
      else process.env.MINIO_PUBLIC_URL = OLD;
    });

    it('builds a signing client against MINIO_PUBLIC_URL when set', () => {
      process.env.MINIO_PUBLIC_URL = 'https://storage.noetia.app';
      jest.clearAllMocks();
      new StorageService();
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://storage.noetia.app', forcePathStyle: true }),
      );
    });

    it('returns the signed URL unchanged — no post-sign host rewrite', async () => {
      process.env.MINIO_PUBLIC_URL = 'https://storage.noetia.app';
      const signed = 'https://storage.noetia.app/audio/books/x.mp3?X-Amz-Signature=abc';
      (getSignedUrl as jest.Mock).mockResolvedValue(signed);
      const svc = new StorageService();
      expect(await svc.presign('audio', 'books/x.mp3', 900)).toBe(signed);
    });
  });
});
