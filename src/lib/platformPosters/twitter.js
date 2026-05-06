// PostHive — X (Twitter) poster using OAuth 2.0 and API v2 media upload
// v1.1 media upload was deprecated June 2025. This uses the new v2 endpoints.

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

    const d = await res.json();
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

  console.log(`Starting X media upload v2 (${mediaCategory}, ${totalBytes} bytes)...`);

  const uploadUrl = 'https://api.x.com/2/media/upload';

  // 1. INIT
  const initForm = new FormData();
  initForm.append('command', 'INIT');
  initForm.append('media_type', mediaType);
  initForm.append('total_bytes', String(totalBytes));
  initForm.append('media_category', mediaCategory);

  const initRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: initForm,
  });

  const initData = await initRes.json();
  console.log('X INIT response:', initData);
  if (!initRes.ok || !initData.data?.id) {
    throw new Error(initData.detail || initData.errors?.[0]?.message || 'X INIT failed');
  }

  const mediaId = initData.data.id;
  console.log(`X media upload initialized. Media ID: ${mediaId}`);

  // 2. APPEND
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (must be <= 5MB)
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
    appendForm.append('media', new Blob([chunk]));

    const appendRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: appendForm,
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error(`X APPEND failed at chunk ${i}: ${err}`);
    }
  }

  // 3. FINALIZE
  console.log('Finalizing X media upload...');
  const finalizeForm = new FormData();
  finalizeForm.append('command', 'FINALIZE');
  finalizeForm.append('media_id', mediaId);

  const finalizeRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: finalizeForm,
  });

  const finalizeData = await finalizeRes.json();
  console.log('X FINALIZE response:', finalizeData);
  if (!finalizeRes.ok) {
    throw new Error(finalizeData.detail || finalizeData.errors?.[0]?.message || 'X FINALIZE failed');
  }

  // 4. STATUS (Polling for video)
  if (isVideo && finalizeData.data?.processing_info) {
    console.log('Waiting for X to process video...');
    let state = finalizeData.data.processing_info.state;
    while (state === 'pending' || state === 'in_progress') {
      const checkAfter = finalizeData.data.processing_info.check_after_secs || 5;
      await new Promise(r => setTimeout(r, checkAfter * 1000));

      const statusRes = await fetch(`${uploadUrl}?command=STATUS&media_id=${mediaId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const statusData = await statusRes.json();

      state = statusData.data?.processing_info?.state;
      if (state === 'failed') {
        throw new Error(statusData.data.processing_info.error?.message || 'X video processing failed');
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

    const tweetData = await tweetRes.json();
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
