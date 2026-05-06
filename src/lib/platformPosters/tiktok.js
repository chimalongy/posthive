// PostHive — Complete TikTok poster (FILE_UPLOAD, sandbox + production)
// Following the mandatory 4-step pipeline described in the TikTok Upload Flow Guide.
// Switched to FILE_UPLOAD to bypass TikTok's strict domain verification requirements for PULL_FROM_URL.

const BASE = 'https://open.tiktokapis.com/v2';

/**
 * Step 0: Refresh the access token if it's expired or about to expire.
 */
async function refreshIfNeeded(credentials) {
  const { clientKey, clientSecret, refreshToken, token_expires_at } = credentials;
  
  // Buffer of 5 minutes
  if (token_expires_at && Date.now() < token_expires_at - 300000) {
    return { credentials, updated: false };
  }

  console.log('TikTok access token expired or missing, refreshing...');
  const res = await fetch(`${BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const d = await res.json();
  if (!res.ok || !d.access_token) {
    throw new Error('TikTok token refresh failed: ' + (d.error_description || d.message || 'Unknown error'));
  }

  const updatedCredentials = {
    ...credentials,
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    token_expires_at: Date.now() + (d.expires_in * 1000),
  };

  return { credentials: updatedCredentials, updated: true };
}

/**
 * Step 1: Query Creator Info (Mandatory before init)
 */
async function queryCreatorInfo(accessToken) {
  console.log('Querying TikTok creator info...');
  const res = await fetch(`${BASE}/post/publish/creator_info/query/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });
  const d = await res.json();
  if (d.error?.code !== 'ok') {
    throw new Error('TikTok creator info query failed: ' + (d.error?.message || 'Unknown error'));
  }
  return d.data;
}

/**
 * Step 2: Initialize Upload (Method B: FILE_UPLOAD)
 */
async function initUpload(accessToken, videoSize, caption, creatorInfo, isSandbox) {
  console.log('Initializing TikTok upload (FILE_UPLOAD)...');
  const endpoint = isSandbox
    ? `${BASE}/post/publish/inbox/video/init/`
    : `${BASE}/post/publish/video/init/`;

  let chunkSize = 10 * 1024 * 1024; // 10 MB default
  let totalChunkCount = Math.ceil(videoSize / chunkSize);

  // If the file is smaller than our default chunk size, or fits in one chunk
  if (totalChunkCount === 1) {
    chunkSize = videoSize;
  }

  const body = {
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount
    }
  };

  // Sandbox init DOES NOT support post_info
  if (!isSandbox) {
    body.post_info = {
      title: caption?.slice(0, 100) || 'PostHive Upload',
      privacy_level: creatorInfo.privacy_level_options?.[0] || 'SELF_ONLY',
      disable_duet: creatorInfo.duet_disabled || false,
      disable_comment: creatorInfo.comment_disabled || false,
      disable_stitch: creatorInfo.stitch_disabled || false,
      video_cover_timestamp_ms: 1000,
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });

  const d = await res.json();
  if (d.error?.code !== 'ok') {
    throw new Error('TikTok upload initialization failed: ' + (d.error?.message || 'Unknown error'));
  }

  return {
    publishId: d.data.publish_id,
    uploadUrl: d.data.upload_url
  };
}

/**
 * Step 3: Transfer Video bytes in chunks
 */
async function uploadInChunks(uploadUrl, fileBuffer) {
  console.log('Transferring video to TikTok in chunks...');
  const totalSize = fileBuffer.byteLength;
  let chunkSize = 10 * 1024 * 1024; // 10 MB
  
  if (totalSize <= chunkSize) {
    chunkSize = totalSize;
  }
  
  const totalChunks = Math.ceil(totalSize / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunk = fileBuffer.slice(start, end);

    console.log(`Uploading chunk ${i + 1}/${totalChunks} (${chunk.byteLength} bytes)...`);
    
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
      },
      body: chunk,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Chunk ${i + 1}/${totalChunks} upload failed: HTTP ${res.status} - ${errorText}`);
    }
  }
}

/**
 * Step 4: Poll Publish Status (Async)
 */
async function pollStatus(accessToken, publishId, isSandbox) {
  console.log('Polling TikTok publish status...');
  let delay = 3000;
  const maxAttempts = 30; // Increased for file processing

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delay));

    const res = await fetch(`${BASE}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const d = await res.json();
    const status = d.data?.status;

    if (status === 'PUBLISH_COMPLETE') {
      return { 
        success: true, 
        postId: d.data.publicaly_available_post_id?.[0] || 'published' 
      };
    }

    if (status === 'SEND_TO_USER_INBOX' && isSandbox) {
      return { 
        success: true, 
        postId: null, 
        note: 'Sandbox success: Post sent to your TikTok inbox as a draft.' 
      };
    }

    if (status === 'FAILED') {
      return { 
        success: false, 
        error: d.data?.fail_reason || 'TikTok processing failed' 
      };
    }

    // Still processing, back off and retry
    console.log(`TikTok status: ${status}. Retrying in ${delay/1000}s...`);
    delay = Math.min(delay * 1.5, 30000);
  }

  return { success: false, error: 'TikTok status polling timed out' };
}

/**
 * Main export for PostHive
 */
export async function postToTikTok(credentials, mediaUrl, caption) {
  let updatedTokens = null;
  
  try {
    // Step 0: Refresh token
    const refreshResult = await refreshIfNeeded(credentials);
    const currentCreds = refreshResult.credentials;
    if (refreshResult.updated) {
      updatedTokens = {
        accessToken: currentCreds.accessToken,
        refreshToken: currentCreds.refreshToken,
        token_expires_at: currentCreds.token_expires_at
      };
    }

    // Pre-fetch: Get video bytes from mediaUrl (Supabase)
    console.log('Fetching video from storage...');
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) throw new Error('Failed to fetch video from storage');
    const videoBuffer = await videoRes.arrayBuffer();
    const videoSize = videoBuffer.byteLength;

    // Step 1: Mandatory Creator Info Query
    const creatorInfo = await queryCreatorInfo(currentCreds.accessToken);

    // Step 2: Initialize Upload (FILE_UPLOAD)
    const { publishId, uploadUrl } = await initUpload(
      currentCreds.accessToken,
      videoSize,
      caption,
      creatorInfo,
      currentCreds.isSandbox
    );

    // Step 3: Video Transfer (FILE_UPLOAD chunks)
    await uploadInChunks(uploadUrl, videoBuffer);

    // Step 4: Poll Status
    const result = await pollStatus(currentCreds.accessToken, publishId, currentCreds.isSandbox);

    return {
      ...result,
      updatedTokens
    };
  } catch (err) {
    console.error('TikTok Poster Error:', err);
    return { 
      success: false, 
      error: err.message || 'TikTok API error',
      updatedTokens
    };
  }
}
