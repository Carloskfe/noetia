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

  describe('getText', () => {
    it('decodes the object as UTF-8 text', async () => {
      async function* body() { yield Buffer.from('ni'); yield new Uint8Array([0xc3, 0xb1]); yield Buffer.from('o'); }
      mockSend.mockResolvedValue({ Body: body() });
      expect(await service.getText('texts/b.txt')).toBe('niño');
      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'books', Key: 'texts/b.txt' });
    });
  });

  describe('publicUrl', () => {
    const saved = process.env.MINIO_PUBLIC_URL;
    afterEach(() => { if (saved === undefined) delete process.env.MINIO_PUBLIC_URL; else process.env.MINIO_PUBLIC_URL = saved; });
    it('uses MINIO_PUBLIC_URL when set, else the internal host', () => {
      process.env.MINIO_PUBLIC_URL = 'https://storage.example.invalid';
      expect(service.publicUrl('images', 'a.png')).toBe('https://storage.example.invalid/images/a.png');
      delete process.env.MINIO_PUBLIC_URL;
      expect(service.publicUrl('images', 'a.png')).toBe('http://storage:9000/images/a.png');
    });
  });

  describe('getBytes (NEM-023)', () => {
    async function* body(...parts: (Buffer | Uint8Array)[]) { for (const p of parts) yield p; }

    it('returns the exact object bytes, concatenated, without decoding', async () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      mockSend.mockResolvedValue({ Body: body(bom, new Uint8Array([0x61, 0xc3]), Buffer.from([0xa9])) });
      const bytes = await service.getBytes('texts/book.txt');
      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'books', Key: 'texts/book.txt' });
      expect([...bytes]).toEqual([0xef, 0xbb, 0xbf, 0x61, 0xc3, 0xa9]);
    });

    it('honours a bucket override and propagates S3 errors', async () => {
      mockSend.mockResolvedValueOnce({ Body: body() });
      expect((await service.getBytes('k', 'other')).length).toBe(0);
      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'other', Key: 'k' });
      mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));
      await expect(service.getBytes('missing')).rejects.toThrow('NoSuchKey');
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
