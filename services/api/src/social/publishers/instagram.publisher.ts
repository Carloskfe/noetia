import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

export class InstagramPublisher {
  static async publish(
    accessToken: string,
    imageBuffer: Buffer,
    caption: string | undefined,
    enabled: boolean,
  ): Promise<string> {
    if (!enabled) {
      throw new ServiceUnavailableException('instagram_publish_unavailable');
    }

    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id&access_token=${accessToken}`,
    );
    if (!meRes.ok) throw new BadGatewayException('platform_publish_failed');
    const me = (await meRes.json()) as { id: string };
    const userId = me.id;

    const imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${userId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption ?? '',
          access_token: accessToken,
        }),
      },
    );
    if (!containerRes.ok) throw new BadGatewayException('platform_publish_failed');
    const container = (await containerRes.json()) as { id: string };

    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${userId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: accessToken,
        }),
      },
    );
    if (!publishRes.ok) throw new BadGatewayException('platform_publish_failed');
    const published = (await publishRes.json()) as { id: string };
    return `https://www.instagram.com/p/${published.id}`;
  }
}
