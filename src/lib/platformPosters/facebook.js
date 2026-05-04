/**
 * Facebook Graph API Poster
 * Uses the latest v22.0 endpoints for Page posting.
 */
export async function postToFacebook(credentials, mediaUrl, caption, isVideo) {
  const { pageAccessToken, pageId } = credentials;

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Missing Facebook Page Access Token or Page ID' };
  }

  try {
    const baseUrl = 'https://graph.facebook.com/v22.0';
    console.log(`Posting to Facebook Page ${pageId} (${isVideo ? 'video' : 'photo'})...`);

    if (isVideo) {
      // Post video to /{page-id}/videos
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
        console.error('Facebook Video Error:', data.error);
        return { success: false, error: data.error?.message || 'Facebook video upload failed' };
      }
      return { success: true, postId: data.id };
    } else {
      // Post photo to /{page-id}/photos
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
        console.error('Facebook Photo Error:', data.error);
        return { success: false, error: data.error?.message || 'Facebook photo upload failed' };
      }
      return { success: true, postId: data.id };
    }
  } catch (err) {
    console.error('Facebook Poster Exception:', err);
    return { success: false, error: err.message || 'Facebook API error' };
  }
}
