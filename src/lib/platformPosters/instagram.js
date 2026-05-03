export async function postToInstagram(credentials, mediaUrl, caption, isVideo) {
  const { igBusinessAccountId, pageAccessToken } = credentials;

  if (!igBusinessAccountId || !pageAccessToken) {
    return { success: false, error: 'Missing Instagram Business Account ID or Page Access Token' };
  }

  try {
    const baseUrl = 'https://graph.facebook.com/v22.0';

    // Step 1: Create media container
    const containerRes = await fetch(`${baseUrl}/${igBusinessAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [isVideo ? 'video_url' : 'image_url']: mediaUrl,
        caption,
        access_token: pageAccessToken,
      }),
    });

    const containerData = await containerRes.json();
    if (!containerRes.ok || containerData.error) {
      return { success: false, error: containerData.error?.message || 'Failed to create Instagram media container' };
    }

    const creationId = containerData.id;

    // Wait briefly for media to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 2: Publish media container
    const publishRes = await fetch(`${baseUrl}/${igBusinessAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: pageAccessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok || publishData.error) {
      return { success: false, error: publishData.error?.message || 'Failed to publish Instagram post' };
    }

    return { success: true, postId: publishData.id };
  } catch (err) {
    return { success: false, error: err.message || 'Instagram API error' };
  }
}
