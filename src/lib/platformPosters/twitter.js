import crypto from 'crypto';

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

export async function postToTwitter(credentials, mediaUrl, caption, isVideo) {
  const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = credentials;

  if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
    return { success: false, error: 'Missing Twitter OAuth 1.0a credentials' };
  }

  try {
    let mediaId = null;

    // Upload media if present
    if (mediaUrl) {
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        return { success: false, error: 'Failed to fetch media file from storage' };
      }
      const mediaBuffer = await mediaRes.arrayBuffer();
      const mediaBlob = new Blob([mediaBuffer]);

      const formData = new FormData();
      formData.append('media', mediaBlob, 'media');

      const uploadAuth = buildAuthHeader('POST', 'https://upload.twitter.com/1.1/media/upload.json', {}, apiKey, apiKeySecret, accessToken, accessTokenSecret);

      const uploadRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          Authorization: uploadAuth,
        },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.errors) {
        return { success: false, error: uploadData.errors?.[0]?.message || 'Twitter media upload failed' };
      }

      mediaId = uploadData.media_id_string;
    }

    // Post tweet
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
      return { success: false, error: tweetData.errors?.[0]?.message || tweetData.detail || 'Twitter post failed' };
    }

    return { success: true, postId: tweetData.data?.id };
  } catch (err) {
    return { success: false, error: err.message || 'Twitter API error' };
  }
}
