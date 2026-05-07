import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildOAuthHeader({ method, url, oauthParams, consumerSecret, tokenSecret = '' }) {
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  const signed = { ...oauthParams, oauth_signature: signature };

  return (
    'OAuth ' +
    Object.keys(signed)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(signed[k])}"`)
      .join(', ')
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Read what's stored in Supabase
  const { data: record, error: dbError } = await supabase
    .from('connected_platforms')
    .select('credentials, is_active, connected_at')
    .eq('user_id', user.id)
    .eq('platform', 'twitter')
    .single();

  if (dbError || !record) {
    return NextResponse.json({ error: 'No Twitter record found in database', dbError }, { status: 404 });
  }

  const { apiKey, apiKeySecret, accessToken, accessTokenSecret, screenName, twitterUserId } = record.credentials || {};

  const credentialSummary = {
    apiKey:              apiKey        ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`              : 'MISSING',
    apiKeySecret:        apiKeySecret  ? `${apiKeySecret.slice(0, 4)}...${apiKeySecret.slice(-4)}`  : 'MISSING',
    accessToken:         accessToken   ? `${accessToken.slice(0, 6)}...${accessToken.slice(-4)}`    : 'MISSING',
    accessTokenSecret:   accessTokenSecret ? `${accessTokenSecret.slice(0, 4)}...${accessTokenSecret.slice(-4)}` : 'MISSING',
    screenName:          screenName    || 'not stored',
    twitterUserId:       twitterUserId || 'not stored',
    is_active:           record.is_active,
    connected_at:        record.connected_at,
  };

  // 2. If all 4 creds exist, test them against Twitter v2 /users/me
  let twitterTest = null;

  if (apiKey && apiKeySecret && accessToken && accessTokenSecret) {
    try {
      const testUrl = 'https://api.twitter.com/2/users/me';
      const oauthParams = {
        oauth_consumer_key:     apiKey,
        oauth_token:            accessToken,
        oauth_nonce:            crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
        oauth_version:          '1.0',
      };

      const authHeader = buildOAuthHeader({
        method:         'GET',
        url:            testUrl,
        oauthParams,
        consumerSecret: apiKeySecret,
        tokenSecret:    accessTokenSecret,
      });

      const res = await fetch(testUrl, {
        headers: { Authorization: authHeader },
      });

      const body = await res.json();
      twitterTest = { status: res.status, ok: res.ok, body };
    } catch (err) {
      twitterTest = { error: err.message };
    }
  } else {
    twitterTest = { skipped: 'Missing one or more credentials — cannot test' };
  }

  return NextResponse.json({
    storedCredentials: credentialSummary,
    twitterApiTest: twitterTest,
  });
}
