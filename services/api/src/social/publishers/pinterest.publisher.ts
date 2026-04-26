import { BadGatewayException } from '@nestjs/common';

export class PinterestPublisher {
  static async publish(
    accessToken: string,
    imageUrl: string,
    caption?: string,
  ): Promise<string> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=1', { headers });
    if (!boardsRes.ok) throw new BadGatewayException('platform_publish_failed');
    const boards = (await boardsRes.json()) as { items: { id: string }[] };
    if (!boards.items?.length) throw new BadGatewayException('platform_publish_failed');
    const boardId = boards.items[0].id;

    const pinRes = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        board_id: boardId,
        media_source: {
          source_type: 'image_url',
          url: imageUrl,
        },
        description: caption ?? '',
      }),
    });

    if (!pinRes.ok) throw new BadGatewayException('platform_publish_failed');
    const pin = (await pinRes.json()) as { id: string };
    return `https://www.pinterest.com/pin/${pin.id}`;
  }
}
