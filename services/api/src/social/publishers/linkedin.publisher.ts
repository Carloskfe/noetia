import { BadGatewayException } from '@nestjs/common';

export class LinkedInPublisher {
  static async publish(
    accessToken: string,
    imageBuffer: Buffer,
    caption?: string,
  ): Promise<string> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    const profileRes = await fetch('https://api.linkedin.com/v2/me', { headers });
    if (!profileRes.ok) throw new BadGatewayException('platform_publish_failed');
    const profile = (await profileRes.json()) as { id: string };
    const urn = `urn:li:person:${profile.id}`;

    const registerRes = await fetch(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: urn,
            serviceRelationships: [
              { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
            ],
          },
        }),
      },
    );

    if (!registerRes.ok) throw new BadGatewayException('platform_publish_failed');
    const registerData = (await registerRes.json()) as {
      value: { uploadMechanism: { 'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': { uploadUrl: string } }; asset: string };
    };
    const uploadUrl =
      registerData.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl;
    const assetUrn = registerData.value.asset;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/png' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: new Blob([imageBuffer as any], { type: 'image/png' }),
    });
    if (!uploadRes.ok) throw new BadGatewayException('platform_publish_failed');

    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: urn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: caption ?? '' },
            shareMediaCategory: 'IMAGE',
            media: [{ status: 'READY', media: assetUrn }],
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!postRes.ok) throw new BadGatewayException('platform_publish_failed');
    const postHeader = postRes.headers.get('x-restli-id') ?? '';
    const postId = encodeURIComponent(postHeader);
    return `https://www.linkedin.com/feed/update/${postId}`;
  }
}
