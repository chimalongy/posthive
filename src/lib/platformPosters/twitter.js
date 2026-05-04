import crypto from 'crypto';

/**
 * Twitter OAuth 1.0a Helpers
 */
function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function buildSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret || '')}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthHeader(method, url, params, apiKey, apiSecret, accessToken, accessTokenSecret) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...params };
  const signature = buildSignature(method, url, allParams, apiSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${header}`;
}

/**
 * Twitter Chunked Media Upload
 */
async function uploadMedia(credentials, fileBuffer, isVideo) {
  const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = credentials;
  const totalBytes = fileBuffer.byteLength;
  const mediaType = isVideo ? 'video/mp4' : 'image/jpeg';
  const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';

  console.log(`Starting Twitter media upload (${mediaCategory}, ${totalBytes} bytes)...`);

  // 1. INIT
  const initUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const initParams = {
    command: 'INIT',
    total_bytes: totalBytes.toString(),
    media_type: mediaType,
    media_category: mediaCategory
  };
  const initAuth = buildAuthHeader('POST', initUrl, initParams, apiKey, apiKeySecret, accessToken, accessTokenSecret);
  
  const initRes = await fetch(`${initUrl}?${new URLSearchParams(initParams)}`, {
    method: 'POST',
    headers: { Authorization: initAuth }
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(initData.errors?.[0]?.message || 'Twitter INIT failed');

  const mediaId = initData.media_id_string;

  // 2. APPEND
  const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = fileBuffer.slice(start, end);

    console.log(`Uploading Twitter media chunk ${i + 1}/${totalChunks}...`);

    const appendParams = {
      command: 'APPEND',
      media_id: mediaId,
      segment_index: i.toString()
    };
    
    // For APPEND, the media data is sent in the body as form-data
    const formData = new FormData();
    formData.append('media', new Blob([chunk]));

    const appendAuth = buildAuthHeader('POST', initUrl, appendParams, apiKey, apiKeySecret, accessToken, accessTokenSecret);
    
    const appendRes = await fetch(`${initUrl}?${new URLSearchParams(appendParams)}`, {
      method: 'POST',
      headers: { Authorization: appendAuth },
      body: formData
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error(`Twitter APPEND failed at chunk ${i}: ${err}`);
    }
  }

  // 3. FINALIZE
  console.log('Finalizing Twitter media upload...');
  const finalizeParams = { command: 'FINALIZE', media_id: mediaId };
  const finalizeAuth = buildAuthHeader('POST', initUrl, finalizeParams, apiKey, apiKeySecret, accessToken, accessTokenSecret);
  
  const finalizeRes = await fetch(`${initUrl}?${new URLSearchParams(finalizeParams)}`, {
    method: 'POST',
    headers: { Authorization: finalizeAuth }
  });
  const finalizeData = await finalizeRes.json();
  if (!finalizeRes.ok) throw new Error(finalizeData.errors?.[0]?.message || 'Twitter FINALIZE failed');

  // 4. STATUS (Polling for video)
  if (isVideo && finalizeData.processing_info) {
    console.log('Waiting for Twitter to process video...');
    let state = finalizeData.processing_info.state;
    while (state === 'pending' || state === 'in_progress') {
      const checkAfter = finalizeData.processing_info.check_after_secs || 5;
      await new Promise(r => setTimeout(r, checkAfter * 1000));

      const statusParams = { command: 'STATUS', media_id: mediaId };
      const statusAuth = buildAuthHeader('GET', initUrl, statusParams, apiKey, apiKeySecret, accessToken, accessTokenSecret);
      const statusRes = await fetch(`${initUrl}?${new URLSearchParams(statusParams)}`, {
        method: 'GET',
        headers: { Authorization: statusAuth }
      });
      const statusData = await statusRes.json();
      
      state = statusData.processing_info?.state;
      if (state === 'failed') {
        throw new Error(statusData.processing_info.error?.message || 'Twitter video processing failed');
      }
    }
  }

  return mediaId;
}

/**
 * Main export for PostHive
 */
export async function postToTwitter(credentials, mediaUrl, caption, isVideo) {
  const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = credentials;

  if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
    return { success: false, error: 'Missing Twitter OAuth 1.0a credentials' };
  }

  try {
    let mediaId = null;

    // 1. Fetch and Upload Media
    if (mediaUrl) {
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) throw new Error('Failed to fetch media from storage');
      const mediaBuffer = await mediaRes.arrayBuffer();
      mediaId = await uploadMedia(credentials, mediaBuffer, isVideo);
    }

    // 2. Post Tweet (API v2)
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    const tweetBody = { text: caption };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }

    const tweetAuth = buildAuthHeader('POST', tweetUrl, {}, apiKey, apiKeySecret, accessToken, accessTokenSecret);

    const tweetRes = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        Authorization: tweetAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData = await tweetRes.json();
    if (!tweetRes.ok || tweetData.errors) {
      return { 
        success: false, 
        error: tweetData.errors?.[0]?.message || tweetData.detail || 'Twitter post failed' 
      };
    }

    return { success: true, postId: tweetData.data?.id };
  } catch (err) {
    console.error('Twitter Poster Error:', err);
    return { success: false, error: err.message || 'Twitter API error' };
  }
}
