/**
 * PostHive — Twitter/X poster
 *
 * Auth:         OAuth 1.0a (same approach that SVP uses and confirmed working)
 * Image upload: POST /1.1/media/upload.json  (simple base64 — allowed on Free tier)
 *               NOTE: X has flagged v1.1 for eventual deprecation but it is
 *               currently the only reliable option for image upload on the Free
 *               tier. When X fully enforces /2/media/upload we will need OAuth
 *               2.0 PKCE with the `media.write` scope.
 * Video upload: POST /1.1/media/upload.json  (chunked INIT/APPEND/FINALIZE — Free tier)
 * Tweet post:   POST /2/tweets               (v2 JSON — the ONLY endpoint allowed for
 *               tweet creation on the Free tier; v1.1 statuses/update is NOT available)
 *               Body: {"text":"...", "media":{"media_ids":["..."]}} (JSON, not form-encoded)
 *               OAuth sig: JSON body is excluded from the OAuth 1.0a signature base string
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// OAuth 1.0a internals
// ---------------------------------------------------------------------------

function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Build an OAuth 1.0a Authorization header.
 *
 * @param {object} opts
 * @param {string}  opts.method          HTTP method (GET / POST)
 * @param {string}  opts.url             Full request URL (no query string)
 * @param {object}  opts.oauthParams     OAuth-specific params (oauth_consumer_key etc.)
 * @param {object}  [opts.bodyParams]    URL-encoded body params to include in signature
 *                                       (only for application/x-www-form-urlencoded bodies)
 * @param {string}  opts.consumerSecret
 * @param {string}  [opts.tokenSecret]
 */
function buildOAuthHeader({
  method,
  url,
  oauthParams,
  bodyParams = {},
  consumerSecret,
  tokenSecret = '',
}) {
  // Merge oauth params + body params for the signature base string only
  const allParams = { ...oauthParams, ...bodyParams };

  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  const signed = { ...oauthParams, oauth_signature: signature };

  return (
    'OAuth ' +
    Object.keys(signed)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(signed[k])}"`)
      .join(', ')
  );
}

/** Generate the four OAuth params that are the same for every request. */
function baseOAuthParams(apiKey, accessToken) {
  return {
    oauth_consumer_key:     apiKey,
    oauth_token:            accessToken,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_version:          '1.0',
  };
}

// ---------------------------------------------------------------------------
// Image upload  — v1.1 simple base64 upload
// ---------------------------------------------------------------------------

/**
 * Upload an image via the v1.1 simple upload endpoint.
 * The media_data field (base64) MUST be included in the OAuth signature.
 * This is the same technique SVP uses and it works reliably.
 *
 * @param {object} credentials
 * @param {ArrayBuffer} imageBuffer
 * @returns {Promise<string>} media_id_string
 */
async function uploadImage(credentials, imageBuffer) {
  const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = credentials;
  const url = 'https://upload.twitter.com/1.1/media/upload.json';

  const mediaData = Buffer.from(imageBuffer).toString('base64');

  // media_data must be part of the OAuth signature because it's a
  // application/x-www-form-urlencoded body parameter.
  const oauthParams = baseOAuthParams(apiKey, accessToken);
  const bodyParams  = { media_data: mediaData };

  const authHeader = buildOAuthHeader({
    method:         'POST',
    url,
    oauthParams,
    bodyParams,      // ← include in signature
    consumerSecret: apiKeySecret,
    tokenSecret:    accessTokenSecret,
  });

  const body = new URLSearchParams(bodyParams).toString();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.errors?.[0]?.message ?? JSON.stringify(data);
    throw new Error(`Twitter image upload failed (${res.status}): ${msg}`);
  }

  return data.media_id_string;
}

// ---------------------------------------------------------------------------
// Video upload  — v1.1 chunked INIT / APPEND / FINALIZE / STATUS
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB per chunk (Twitter minimum)

async function videoChunkUpload(credentials, videoBuffer) {
  const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = credentials;
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const totalBytes = videoBuffer.byteLength;

  // ── INIT ──────────────────────────────────────────────────────────────────
  const initBodyParams = {
    command:        'INIT',
    total_bytes:    totalBytes.toString(),
    media_type:     'video/mp4',
    media_category: 'tweet_video',
  };

  const initOAuth = baseOAuthParams(apiKey, accessToken);
  const initAuth  = buildOAuthHeader({
    method:         'POST',
    url:            uploadUrl,
    oauthParams:    initOAuth,
    bodyParams:     initBodyParams,
    consumerSecret: apiKeySecret,
    tokenSecret:    accessTokenSecret,
  });

  const initRes = await fetch(uploadUrl, {
    method:  'POST',
    headers: { Authorization: initAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(initBodyParams).toString(),
  });

  const initData = await initRes.json();
  if (!initRes.ok) {
    throw new Error(`Twitter video INIT failed (${initRes.status}): ${initData.errors?.[0]?.message ?? JSON.stringify(initData)}`);
  }

  const mediaId = initData.media_id_string;

  // ── APPEND (chunked) ──────────────────────────────────────────────────────
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = videoBuffer.slice(start, end);

    // For APPEND the media data is multipart/form-data.
    // The OAuth signature only covers the URL-encoded params (command, media_id, segment_index),
    // NOT the binary media chunk — that goes in the multipart body.
    const appendBodyParams = {
      command:        'APPEND',
      media_id:       mediaId,
      segment_index:  i.toString(),
    };

    const appendOAuth = baseOAuthParams(apiKey, accessToken);
    const appendAuth  = buildOAuthHeader({
      method:         'POST',
      url:            uploadUrl,
      oauthParams:    appendOAuth,
      // IMPORTANT: multipart/form-data body params must NOT be included in the
      // OAuth 1.0a signature. Only the OAuth header params are signed here.
      consumerSecret: apiKeySecret,
      tokenSecret:    accessTokenSecret,
    });

    const formData = new FormData();
    formData.append('command',        'APPEND');
    formData.append('media_id',       mediaId);
    formData.append('segment_index',  i.toString());
    formData.append('media',          new Blob([chunk], { type: 'video/mp4' }));

    const appendRes = await fetch(uploadUrl, {
      method:  'POST',
      headers: { Authorization: appendAuth },
      // Note: do NOT set Content-Type here — fetch sets it automatically for
      // FormData, including the required boundary parameter.
      body:    formData,
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      throw new Error(`Twitter video APPEND failed at chunk ${i} (${appendRes.status}): ${errText}`);
    }
  }

  // ── FINALIZE ──────────────────────────────────────────────────────────────
  const finalizeBodyParams = { command: 'FINALIZE', media_id: mediaId };
  const finalizeOAuth      = baseOAuthParams(apiKey, accessToken);
  const finalizeAuth       = buildOAuthHeader({
    method:         'POST',
    url:            uploadUrl,
    oauthParams:    finalizeOAuth,
    bodyParams:     finalizeBodyParams,
    consumerSecret: apiKeySecret,
    tokenSecret:    accessTokenSecret,
  });

  const finalizeRes = await fetch(uploadUrl, {
    method:  'POST',
    headers: { Authorization: finalizeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(finalizeBodyParams).toString(),
  });

  const finalizeData = await finalizeRes.json();
  if (!finalizeRes.ok) {
    throw new Error(`Twitter video FINALIZE failed (${finalizeRes.status}): ${finalizeData.errors?.[0]?.message ?? JSON.stringify(finalizeData)}`);
  }

  // ── STATUS (poll until Twitter finishes processing the video) ─────────────
  if (finalizeData.processing_info) {
    let processingInfo = finalizeData.processing_info;

    while (processingInfo.state === 'pending' || processingInfo.state === 'in_progress') {
      const waitSecs = processingInfo.check_after_secs ?? 5;
      await new Promise((r) => setTimeout(r, waitSecs * 1000));

      const statusParams      = { command: 'STATUS', media_id: mediaId };
      const statusOAuth       = baseOAuthParams(apiKey, accessToken);
      const statusAuth        = buildOAuthHeader({
        method:         'GET',
        url:            uploadUrl,
        oauthParams:    statusOAuth,
        bodyParams:     statusParams,
        consumerSecret: apiKeySecret,
        tokenSecret:    accessTokenSecret,
      });

      const qs        = new URLSearchParams(statusParams).toString();
      const statusRes = await fetch(`${uploadUrl}?${qs}`, {
        method:  'GET',
        headers: { Authorization: statusAuth },
      });

      const statusData = await statusRes.json();
      processingInfo   = statusData.processing_info ?? {};

      if (processingInfo.state === 'failed') {
        throw new Error(
          `Twitter video processing failed: ${processingInfo.error?.message ?? 'Unknown reason'}`
        );
      }
    }
  }

  return mediaId;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Post content to Twitter/X on behalf of a user.
 *
 * @param {object}  credentials               Stored in connected_platforms.credentials
 * @param {string}  credentials.apiKey        Consumer Key
 * @param {string}  credentials.apiKeySecret  Consumer Secret
 * @param {string}  credentials.accessToken
 * @param {string}  credentials.accessTokenSecret
 * @param {string|null} mediaUrl              Signed Supabase Storage URL (or null for text-only)
 * @param {string}  caption                   Tweet text (max 280 chars)
 * @param {boolean} [isVideo]                 True when the media is a video file
 *
 * @returns {Promise<{success: boolean, postId?: string, error?: string}>}
 */
export async function postToTwitter(credentials, mediaUrl, caption, isVideo = false) {
  const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = credentials;

  // ── Validate credentials ──────────────────────────────────────────────────
  if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
    const missing = ['apiKey', 'apiKeySecret', 'accessToken', 'accessTokenSecret']
      .filter((k) => !credentials[k])
      .join(', ');
    return {
      success: false,
      error: `Missing Twitter credentials: ${missing}. Please reconnect your Twitter account.`,
    };
  }

  try {
    // ── 1. Upload media (if provided) ──────────────────────────────────────
    let mediaId = null;

    if (mediaUrl) {
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        throw new Error(`Failed to download media from storage (${mediaRes.status})`);
      }
      const mediaBuffer = await mediaRes.arrayBuffer();

      if (isVideo) {
        mediaId = await videoChunkUpload(credentials, mediaBuffer);
      } else {
        mediaId = await uploadImage(credentials, mediaBuffer);
      }
    }

    // ── 2. Post the tweet via API v2 ─────────────────────────────────────
    // NOTE: v1.1/statuses/update.json is NOT available on the Free tier.
    // Only v2 /2/tweets is permitted for tweet creation on Free.
    // v1.1 media/upload is still the correct upload endpoint (also on Free).
    const tweetUrl = 'https://api.twitter.com/2/tweets';

    // v2 uses a JSON body — do NOT include JSON body params in the OAuth
    // 1.0a signature (only URL-encoded form params go into the sig base string).
    const tweetPayload = { text: caption || '' };
    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    const tweetOAuth = baseOAuthParams(apiKey, accessToken);
    const tweetAuth  = buildOAuthHeader({
      method:         'POST',
      url:            tweetUrl,
      oauthParams:    tweetOAuth,
      // No bodyParams — JSON bodies are NOT part of the OAuth 1.0a signature
      consumerSecret: apiKeySecret,
      tokenSecret:    accessTokenSecret,
    });

    const tweetRes = await fetch(tweetUrl, {
      method:  'POST',
      headers: {
        Authorization:  tweetAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetPayload),
    });

    const tweetData = await tweetRes.json();

    if (!tweetRes.ok || tweetData.errors) {
      const errMsg =
        tweetData.errors?.[0]?.message ??
        tweetData.detail ??
        JSON.stringify(tweetData);
      return { success: false, error: `Twitter post failed (${tweetRes.status}): ${errMsg}` };
    }

    // v2 response shape: { data: { id: "...", text: "..." } }
    return { success: true, postId: String(tweetData.data?.id ?? tweetData.id) };

  } catch (err) {
    console.error('[Twitter Poster]', err);
    return { success: false, error: err.message ?? 'Unexpected Twitter API error' };
  }
}