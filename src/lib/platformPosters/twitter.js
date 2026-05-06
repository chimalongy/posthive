// PostHive — X (Twitter) poster using twitter-api-v2 library
// Uses OAuth 2.0 User Context (Authorization Code + PKCE)

import { TwitterApi } from 'twitter-api-v2';

/**
 * Build an authenticated TwitterApi client from stored credentials
 */
function getClient(credentials) {
  return new TwitterApi(credentials.accessToken);
}

/**
 * Refresh OAuth 2.0 access token if expired or close to expiry
 */
async function refreshIfNeeded(credentials) {
  const { clientId, clientSecret, refreshToken, token_expires_at } = credentials;

  if (!refreshToken) {
    return { credentials, updated: false };
  }

  // Buffer of 5 minutes
  if (token_expires_at && Date.now() < token_expires_at - 300000) {
    return { credentials, updated: false };
  }

  console.log('X: access token expired or expiring soon, refreshing...');
  try {
    // Use the library's built-in OAuth2 refresh
    const appClient = new TwitterApi({
      clientId,
      clientSecret,
    });

    const { accessToken, refreshToken: newRefreshToken, expiresIn } = await appClient.refreshOAuth2Token(refreshToken);

    const updatedCredentials = {
      ...credentials,
      accessToken,
      refreshToken: newRefreshToken || refreshToken,
      token_expires_at: Date.now() + (expiresIn * 1000),
    };

    console.log('X: token refreshed successfully.');
    return { credentials: updatedCredentials, updated: true };
  } catch (err) {
    console.error('X Token Refresh Error:', err.message || err);
    throw new Error('X token refresh failed: ' + (err.message || 'Unknown error'));
  }
}

/**
 * Upload media using twitter-api-v2 (handles chunking + v1/v2 routing automatically)
 */
async function uploadMedia(credentials, fileBuffer, mimeType, isVideo) {
  const client = getClient(credentials);

  console.log(`X: uploading media (${mimeType}, ${fileBuffer.byteLength} bytes)...`);

  // twitter-api-v2 v1.uploadMedia handles INIT/APPEND/FINALIZE internally
  const mediaId = await client.v1.uploadMedia(Buffer.from(fileBuffer), {
    mimeType,
    target: isVideo ? 'tweet' : 'tweet',
  });

  console.log(`X: media upload complete. Media ID: ${mediaId}`);
  return mediaId;
}

/**
 * Main export for PostHive
 */
export async function postToTwitter(credentials, mediaUrl, caption, isVideo, mimeType) {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.accessToken) {
    return {
      success: false,
      error: 'Missing X OAuth 2.0 credentials. Please reconnect your Twitter/X account.',
    };
  }

  let updatedTokens = null;

  try {
    // Step 0: Refresh token if needed
    const refreshResult = await refreshIfNeeded(credentials);
    const currentCreds = refreshResult.credentials;
    if (refreshResult.updated) {
      updatedTokens = {
        accessToken: currentCreds.accessToken,
        refreshToken: currentCreds.refreshToken,
        token_expires_at: currentCreds.token_expires_at,
      };
    }

    const client = getClient(currentCreds);
    let mediaId = null;

    // Step 1: Fetch and upload media if provided
    if (mediaUrl) {
      console.log('X: fetching media from storage:', mediaUrl);
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        throw new Error(`Failed to fetch media from storage (HTTP ${mediaRes.status})`);
      }
      const mediaBuffer = await mediaRes.arrayBuffer();
      console.log(`X: media fetched, ${mediaBuffer.byteLength} bytes`);

      // Determine MIME type
      const resolvedMimeType = mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      mediaId = await uploadMedia(currentCreds, mediaBuffer, resolvedMimeType, isVideo);
    }

    // Step 2: Post the tweet using v2
    console.log('X: posting tweet...');
    const tweetPayload = { text: caption || '' };
    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    const tweetResult = await client.v2.tweet(tweetPayload);
    console.log('X: tweet posted successfully. Tweet ID:', tweetResult.data?.id);

    return {
      success: true,
      postId: tweetResult.data?.id,
      updatedTokens,
    };
  } catch (err) {
    // Extract detailed error info from twitter-api-v2 errors
    const apiError = err?.data?.errors?.[0]?.message
      || err?.data?.detail
      || err?.data?.error_description
      || err?.message
      || 'X API error';

    console.error('X Poster Error:', apiError, err?.data || '');
    return { success: false, error: apiError, updatedTokens };
  }
}
