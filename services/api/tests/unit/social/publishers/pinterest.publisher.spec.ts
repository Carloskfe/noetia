import { BadGatewayException } from '@nestjs/common';
import { PinterestPublisher } from '../../../../src/social/publishers/pinterest.publisher';

const IMAGE_URL = 'http://storage/images/card.png';

describe('PinterestPublisher', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publishes and returns a Pinterest pin URL', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'board-1' }] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pin-123' }),
      } as unknown as Response);

    const url = await PinterestPublisher.publish('tok', IMAGE_URL, 'caption');
    expect(url).toBe('https://www.pinterest.com/pin/pin-123');
  });

  it('sends image_url and description in pin body', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'board-1' }] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pin-456' }) } as unknown as Response);
    global.fetch = fetchMock;

    await PinterestPublisher.publish('tok', IMAGE_URL, 'mi cita');

    const [, pinOptions] = fetchMock.mock.calls[1];
    const body = JSON.parse((pinOptions as RequestInit).body as string);
    expect(body.media_source.source_type).toBe('image_url');
    expect(body.media_source.url).toBe(IMAGE_URL);
    expect(body.description).toBe('mi cita');
    expect(body.board_id).toBe('board-1');
  });

  it('sends Authorization header on all calls', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'board-1' }] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pin-789' }) } as unknown as Response);
    global.fetch = fetchMock;

    await PinterestPublisher.publish('my-pinterest-token', IMAGE_URL, undefined);

    for (const call of fetchMock.mock.calls) {
      const opts = call[1] as RequestInit;
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-pinterest-token');
    }
  });

  it('throws BadGatewayException when boards fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false } as Response);
    await expect(PinterestPublisher.publish('tok', IMAGE_URL, undefined)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when user has no boards', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    } as unknown as Response);
    await expect(PinterestPublisher.publish('tok', IMAGE_URL, undefined)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when pin creation fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'board-1' }] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    await expect(PinterestPublisher.publish('tok', IMAGE_URL, undefined)).rejects.toThrow(BadGatewayException);
  });
});
