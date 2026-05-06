// PostHive — X (Twitter) poster using OAuth 2.0 and API v2 media upload
// v1.1 media upload was deprecated June 2025. This uses the new v2 endpoints.

/**
 * Safe JSON parsing helper
 */
async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON:', text);
    return { error: 'Invalid JSON response', raw: text };
  }
}

/**
 * Refresh OAuth 2.0 access token if expired
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

  console.log('X access token expired or missing, refreshing...');
  try {
    const res = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const d = await safeJson(res);
    if (!res.ok || !d.access_token) {
      console.error('X token refresh failed response:', d);
      throw new Error('X token refresh failed: ' + (d.error_description || d.error || 'Unknown error'));
    }

    const updatedCredentials = {
      ...credentials,
      accessToken: d.access_token,
      refreshToken: d.refresh_token || refreshToken,
      token_expires_at: Date.now() + (d.expires_in * 1000),
    };

    return { credentials: updatedCredentials, updated: true };
  } catch (err) {
    console.error('X Token Refresh Exception:', err);
    throw err;
  }
}

/**
 * X API v2 Chunked Media Upload using OAuth 2.0 Bearer token
 */
async function uploadMedia(credentials, fileBuffer, isVideo) {
  const { accessToken } = credentials;
  const totalBytes = fileBuffer.byteLength;
  const mediaType = isVideo ? 'video/mp4' : 'image/jpeg';
  const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';

  console.log(`Starting X media upload v1.1 (${mediaCategory}, ${totalBytes} bytes)...`);

  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  // 1. INIT
  const initRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({
      command: 'INIT',
      media_type: mediaType,
      total_bytes: String(totalBytes),
      media_category: mediaCategory,
    }),
  });

  const initData = await safeJson(initRes);
  console.log('X INIT response:', initData);
  if (!initRes.ok || !initData.media_id_string) {
    console.error('X INIT failed detail:', initData);
    throw new Error(initData.error || initData.errors?.[0]?.message || 'X INIT failed');
  }

  const mediaId = initData.media_id_string;
  console.log(`X media upload initialized. Media ID: ${mediaId}`);

  // 2. APPEND
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = fileBuffer.slice(start, end);

    console.log(`Uploading X media chunk ${i + 1}/${totalChunks}...`);

    const appendForm = new FormData();
    appendForm.append('command', 'APPEND');
    appendForm.append('media_id', mediaId);
    appendForm.append('segment_index', String(i));
    appendForm.append('media', new Blob([chunk], { type: mediaType }));

    const appendRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: appendForm,
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      console.error('X APPEND error detail:', err);
      throw new Error(`X APPEND failed at chunk ${i}: ${err}`);
    }
  }

  // 3. FINALIZE
  console.log('Finalizing X media upload...');
  const finalizeRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  });

  const finalizeData = await safeJson(finalizeRes);
  console.log('X FINALIZE response:', finalizeData);
  if (!finalizeRes.ok) {
    throw new Error(finalizeData.error || finalizeData.errors?.[0]?.message || 'X FINALIZE failed');
  }

  // 4. STATUS (Polling for video)
  if (isVideo && (finalizeData.processing_info || finalizeData.data?.processing_info)) {
    console.log('Waiting for X to process video...');
    const info = finalizeData.processing_info || finalizeData.data.processing_info;
    let state = info.state;

    while (state === 'pending' || state === 'in_progress') {
      const checkAfter = info.check_after_secs || 5;
      await new Promise(r => setTimeout(r, checkAfter * 1000));

      const statusRes = await fetch(`${uploadUrl}?command=STATUS&media_id=${mediaId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const statusData = await safeJson(statusRes);
      console.log('X STATUS response:', statusData);

      const nextInfo = statusData.processing_info || statusData.data?.processing_info;
      state = nextInfo?.state;

      if (state === 'failed') {
        throw new Error(nextInfo.error?.message || 'X video processing failed');
      }
    }
  }

  return mediaId;
}

/**
 * Main export for PostHive
 */
export async function postToTwitter(credentials, mediaUrl, caption, isVideo) {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.accessToken) {
    return { success: false, error: 'Missing X OAuth 2.0 credentials. Please reconnect with Client ID and Secret.' };
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

    let mediaId = null;

    // 1. Fetch and Upload Media
    if (mediaUrl) {
      console.log('Fetching media from:', mediaUrl);
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        console.error('Failed to fetch media:', mediaRes.status, mediaRes.statusText);
        throw new Error('Failed to fetch media from storage');
      }
      const mediaBuffer = await mediaRes.arrayBuffer();
      console.log('Media fetched, size:', mediaBuffer.byteLength);
      mediaId = await uploadMedia(currentCreds, mediaBuffer, isVideo);
    }

    // 2. Post Tweet (API v2 with OAuth 2.0 Bearer)
    const tweetUrl = 'https://api.x.com/2/tweets';
    const tweetBody = { text: caption };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }

    const tweetRes = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentCreds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData = await safeJson(tweetRes);
    if (!tweetRes.ok || tweetData.errors) {
      return {
        success: false,
        error: tweetData.detail || tweetData.errors?.[0]?.message || tweetData.title || 'X post failed',
      };
    }

    return { success: true, postId: tweetData.data?.id, updatedTokens };
  } catch (err) {
    console.error('X Poster Error:', err);
    return { success: false, error: err.message || 'X API error', updatedTokens };
  }
}
