import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

/**
 * OAuth 1.0a Helpers
 */
function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey')?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Get the record to find apiSecret
  const { data: record } = await supabase
    .from('connected_platforms')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'twitter')
    .single();

  if (!record || !record.credentials.apiKeySecret) {
    return NextResponse.json({ error: 'Twitter record not initialized correctly' }, { status: 400 });
  }

  const apiSecret = record.credentials.apiKeySecret;

  // 2. Obtain Request Token
  const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/twitter/callback`;

  const oauthParams = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };

  const signature = buildSignature('POST', requestTokenUrl, oauthParams, apiSecret, '');
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  const tokenRes = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: { Authorization: authHeader }
  });

  const tokenText = await tokenRes.text();
  const data = Object.fromEntries(new URLSearchParams(tokenText));

  if (!tokenRes.ok || !data.oauth_token) {
    return NextResponse.json({ error: 'Twitter request token failed: ' + tokenText }, { status: 500 });
  }

  // 3. Redirect to Twitter
  const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${data.oauth_token}`;
  
  // Store the token_secret in a cookie (temporary) to use in callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('tw_token_secret', data.oauth_token_secret, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600 // 10 minutes
  });

  return response;
}
