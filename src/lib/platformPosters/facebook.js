/**
 * Facebook Graph API Poster
 * Uses the latest v22.0 endpoints for Page posting with automatic token refresh.
 */

const API_VERSION = 'v22.0';

async function refreshFacebookToken(credentials) {
  const { appId, appSecret, accessToken, token_expires_at } = credentials;

  // If no appId/appSecret stored, cannot refresh
  if (!appId || !appSecret || !accessToken) {
    return { credentials, updated: false };
  }

  // Only refresh if token is within 7 days of expiry (or already expired)
  if (token_expires_at && Date.now() < token_expires_at - 604800000) {
    return { credentials, updated: false };
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message || 'Facebook token refresh failed');
    }

    const updatedCredentials = {
      ...credentials,
      accessToken: data.access_token,
      pageAccessToken: data.access_token,
      token_expires_at: Date.now() + 5184000000,
    };

    return { credentials: updatedCredentials, updated: true };
  } catch (err) {
    console.warn('Facebook token refresh warning:', err.message);
    return { credentials, updated: false };
  }
}

export async function postToFacebook(credentials, mediaUrl, caption, isVideo, mediaType) {
  const { pageAccessToken, pageId } = credentials;

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Missing Facebook Page Access Token or Page ID' };
  }

  try {
    // Attempt token refresh if needed
    const refreshResult = await refreshFacebookToken(credentials);
    const currentCreds = refreshResult.credentials;
    let updatedTokens = null;
    if (refreshResult.updated) {
      updatedTokens = {
        accessToken: currentCreds.accessToken,
        pageAccessToken: currentCreds.pageAccessToken,
        token_expires_at: currentCreds.token_expires_at,
      };
    }

    const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
    console.log(`Posting to Facebook Page ${pageId} (${isVideo || mediaType === 'video' ? 'video' : 'photo'})...`);

    if (isVideo || mediaType === 'video') {
      const res = await fetch(`${baseUrl}/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: mediaUrl,
          description: caption,
          access_token: currentCreds.pageAccessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error('Facebook Video Error:', data.error);
        return { success: false, error: data.error?.message || 'Facebook video upload failed', updatedTokens };
      }
      return { success: true, postId: data.id, updatedTokens };
    }

    if (!mediaUrl) {
      // Text-only post
      const res = await fetch(`${baseUrl}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: caption,
          access_token: currentCreds.pageAccessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error?.message || 'Facebook post failed', updatedTokens };
      }
      return { success: true, postId: data.id, updatedTokens };
    }

    // Photo post
    const res = await fetch(`${baseUrl}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mediaUrl,
        caption,
        access_token: currentCreds.pageAccessToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('Facebook Photo Error:', data.error);
      return { success: false, error: data.error?.message || 'Facebook photo upload failed', updatedTokens };
    }
    return { success: true, postId: data.id, updatedTokens };
  } catch (err) {
    console.error('Facebook Poster Exception:', err);
    return { success: false, error: err.message || 'Facebook API error' };
  }
}
