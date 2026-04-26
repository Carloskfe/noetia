import { BadGatewayException } from '@nestjs/common';

export class FacebookPublisher {
  static async publish(
    accessToken: string,
    imageBuffer: Buffer,
    caption?: string,
  ): Promise<string> {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`,
    );
    if (!pagesRes.ok) throw new BadGatewayException('platform_publish_failed');
    const pages = (await pagesRes.json()) as { data: { id: string; access_token: string }[] };
    if (!pages.data?.length) throw new BadGatewayException('platform_publish_failed');

    const page = pages.data[0];
    const pageToken = page.access_token;
    const pageId = page.id;

    const formData = new FormData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formData.append('source', new Blob([imageBuffer as any], { type: 'image/png' }), 'card.png');
    formData.append('caption', caption ?? '');
    formData.append('access_token', pageToken);

    const photoRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: 'POST',
      body: formData,
    });

    if (!photoRes.ok) throw new BadGatewayException('platform_publish_failed');
    const photo = (await photoRes.json()) as { post_id?: string; id?: string };
    const postId = photo.post_id ?? photo.id ?? '';
    return `https://www.facebook.com/${postId}`;
  }
}
