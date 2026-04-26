import { BadGatewayException } from '@nestjs/common';
import { FacebookPublisher } from '../../../../src/social/publishers/facebook.publisher';

const PNG = Buffer.from('\x89PNG\r\n\x1a\n' + '\x00'.repeat(100));

describe('FacebookPublisher', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publishes and returns a Facebook post URL', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'page-1', access_token: 'page-tok' }] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ post_id: '12345' }),
      } as unknown as Response);

    const url = await FacebookPublisher.publish('tok', PNG, 'caption');
    expect(url).toContain('facebook.com');
  });

  it('throws BadGatewayException when pages fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false } as Response);
    await expect(FacebookPublisher.publish('tok', PNG, undefined)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when no pages are returned', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);
    await expect(FacebookPublisher.publish('tok', PNG, undefined)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when photo upload fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'page-1', access_token: 'page-tok' }] }),
      } as unknown as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    await expect(FacebookPublisher.publish('tok', PNG, undefined)).rejects.toThrow(BadGatewayException);
  });
});
