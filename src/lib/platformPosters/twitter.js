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
 * X API v2 Chunked Media Upload using OAuth 2.0 User Context Bearer token
 *
 * Endpoints (v2 — no legacy 'command' parameter):
 *   INIT:     POST https://api.twitter.com/2/media/upload/initialize
 *   APPEND:   POST https://api.twitter.com/2/media/upload/{id}/append
 *   FINALIZE: POST https://api.twitter.com/2/media/upload/{id}/finalize
 *   STATUS:   GET  https://api.twitter.com/2/media/upload/{id}
 */
async function uploadMedia(credentials, fileBuffer, isVideo, mimeType) {
  const { accessToken } = credentials;
  const totalBytes = fileBuffer.byteLength;
  const mediaType = mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
  const mediaCategory = isVideo ? 'TweetVideo' : 'TweetImage';

  console.log(`Starting X media upload v2 (${mediaCategory}, ${totalBytes} bytes, ${mediaType})...`);

  // 1. INITIALIZE
  const initRes = await fetch('https://api.twitter.com/2/media/upload/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media_type: mediaType,
      media_category: mediaCategory,
      total_bytes: totalBytes,
    }),
  });

  const initData = await safeJson(initRes);
  console.log('X INIT response:', initData);

  if (!initRes.ok || !initData.id) {
    console.error('X INIT failed detail:', JSON.stringify(initData));
    const errMsg = initData.detail || initData.errors?.[0]?.message || initData.error || 'X INIT failed';
    throw new Error(errMsg);
  }

  const mediaId = initData.id;
  console.log(`X media upload initialized. Media ID: ${mediaId}`);

  // 2. APPEND (chunked binary upload)
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = fileBuffer.slice(start, end);

    console.log(`Uploading X media chunk ${i + 1}/${totalChunks} (bytes ${start}–${end})...`);

    const appendRes = await fetch(`https://api.twitter.com/2/media/upload/${mediaId}/append`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'X-Segment-Index': String(i),
      },
      body: chunk,
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      console.error('X APPEND error detail:', err);
      throw new Error(`X APPEND failed at chunk ${i}: ${err}`);
    }
    console.log(`Chunk ${i + 1}/${totalChunks} uploaded successfully.`);
  }

  // 3. FINALIZE
  console.log('Finalizing X media upload...');
  const finalizeRes = await fetch(`https://api.twitter.com/2/media/upload/${mediaId}/finalize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const finalizeData = await safeJson(finalizeRes);
  console.log('X FINALIZE response:', finalizeData);

  if (!finalizeRes.ok) {
    const errMsg = finalizeData.detail || finalizeData.errors?.[0]?.message || finalizeData.error || 'X FINALIZE failed';
    throw new Error(errMsg);
  }

  // 4. STATUS POLLING (for videos that need processing)
  if (isVideo) {
    const processingInfo = finalizeData.processing_info;
    if (processingInfo && (processingInfo.state === 'pending' || processingInfo.state === 'in_progress')) {
      console.log('Waiting for X to process video...');
      let state = processingInfo.state;
      let checkAfter = processingInfo.check_after_secs || 5;

      while (state === 'pending' || state === 'in_progress') {
        await new Promise(r => setTimeout(r, checkAfter * 1000));

        const statusRes = await fetch(`https://api.twitter.com/2/media/upload/${mediaId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        const statusData = await safeJson(statusRes);
        console.log('X STATUS response:', statusData);

        const info = statusData.processing_info;
        state = info?.state;
        checkAfter = info?.check_after_secs || 5;

        if (state === 'failed') {
          throw new Error(info?.error?.message || 'X video processing failed');
        }
      }
      console.log('X video processing complete.');
    }
  }

  return mediaId;
}

/**
 * Main export for PostHive
 */
export async function postToTwitter(credentials, mediaUrl, caption, isVideo, mimeType) {
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
      mediaId = await uploadMedia(currentCreds, mediaBuffer, isVideo, mimeType);
    }

    // 2. Post Tweet (API v2 with OAuth 2.0 Bearer)
    const tweetUrl = 'https://api.twitter.com/2/tweets';
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
