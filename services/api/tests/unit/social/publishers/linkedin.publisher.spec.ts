import { BadGatewayException } from '@nestjs/common';
import { LinkedInPublisher } from '../../../../src/social/publishers/linkedin.publisher';

const PNG = Buffer.from('\x89PNG\r\n\x1a\n' + '\x00'.repeat(100));

const mockSuccessFlow = () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'profile-id' }),
    } as unknown as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://upload.linkedin.com/img',
            },
          },
          asset: 'urn:li:digitalmediaAsset:123',
        },
      }),
    } as unknown as Response)
    .mockResolvedValueOnce({ ok: true } as Response)
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'urn:li:ugcPost:456' },
    } as unknown as Response);

  global.fetch = fetchMock;
  return fetchMock;
};

describe('LinkedInPublisher', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publishes and returns a LinkedIn post URL', async () => {
    mockSuccessFlow();
    const url = await LinkedInPublisher.publish('tok', PNG, 'caption');
    expect(url).toContain('linkedin.com/feed/update/');
  });

  it('sends Authorization header on all calls', async () => {
    const fetchMock = mockSuccessFlow();
    await LinkedInPublisher.publish('my-token', PNG, undefined);
    for (const call of fetchMock.mock.calls) {
      const opts = call[1] as RequestInit | undefined;
      if (opts?.headers) {
        expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token');
      }
    }
  });

  it('throws BadGatewayException when profile fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false } as Response);
    await expect(LinkedInPublisher.publish('tok', PNG, undefined)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when asset register fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pid' }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    await expect(LinkedInPublisher.publish('tok', PNG, undefined)).rejects.toThrow(BadGatewayException);
  });
});
