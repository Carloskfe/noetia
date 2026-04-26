import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { InstagramPublisher } from '../../../../src/social/publishers/instagram.publisher';

const PNG = Buffer.from('\x89PNG\r\n\x1a\n' + '\x00'.repeat(100));

describe('InstagramPublisher', () => {
  afterEach(() => jest.restoreAllMocks());

  it('throws ServiceUnavailableException when enabled=false', async () => {
    await expect(InstagramPublisher.publish('tok', PNG, undefined, false)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('publishes and returns Instagram post URL when enabled', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-user-1' }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'post-1' }) } as unknown as Response);

    const url = await InstagramPublisher.publish('tok', PNG, 'caption', true);
    expect(url).toContain('instagram.com');
  });

  it('throws BadGatewayException when user fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false } as Response);
    await expect(InstagramPublisher.publish('tok', PNG, undefined, true)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws BadGatewayException when container creation fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-user-1' }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    await expect(InstagramPublisher.publish('tok', PNG, undefined, true)).rejects.toThrow(
      BadGatewayException,
    );
  });
});
