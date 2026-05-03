export async function postToFacebook(credentials, mediaUrl, caption, isVideo) {
  const { appId, appSecret, pageAccessToken, pageId } = credentials;

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Missing Page Access Token or Page ID' };
  }

  try {
    const baseUrl = 'https://graph.facebook.com/v22.0';

    if (isVideo) {
      const res = await fetch(`${baseUrl}/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: mediaUrl,
          description: caption,
          access_token: pageAccessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error?.message || 'Facebook video upload failed' };
      }
      return { success: true, postId: data.id };
    } else {
      const res = await fetch(`${baseUrl}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaUrl,
          caption,
          access_token: pageAccessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error?.message || 'Facebook photo upload failed' };
      }
      return { success: true, postId: data.id };
    }
  } catch (err) {
    return { success: false, error: err.message || 'Facebook API error' };
  }
}
