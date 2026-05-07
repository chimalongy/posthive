import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Minimal OAuth 1.0a helpers (no extra npm packages needed)
// ---------------------------------------------------------------------------

function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Build an HMAC-SHA1 OAuth 1.0a Authorization header for a plain GET/POST
 * where no body params need to be included in the signature (i.e. the body
 * is either empty or JSON, not URL-encoded form data).
 */
function buildOAuthHeader({ method, url, oauthParams, consumerSecret, tokenSecret = '' }) {
  // Sort params and build the signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
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

  const header =
    'OAuth ' +
    Object.keys(signed)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(signed[k])}"`)
      .join(', ');

  return header;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey')?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing apiKey query param' }, { status: 400 });
  }

  // ── 1. Authenticate the user ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Fetch the stored API Key Secret ────────────────────────────────────
  const { data: record, error: dbError } = await supabase
    .from('connected_platforms')
    .select('credentials')
    .eq('user_id', user.id)
    .eq('platform', 'twitter')
    .single();

  if (dbError || !record?.credentials?.apiKeySecret) {
    return NextResponse.json(
      { error: 'Twitter credentials not found. Please save your API Key and API Key Secret first.' },
      { status: 400 }
    );
  }

  const apiKeySecret = record.credentials.apiKeySecret;

  // ── 3. Request a temporary OAuth Request Token from Twitter ───────────────
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const callbackUrl = `${appUrl}/api/twitter/callback`;
  const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';

  const oauthParams = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };

  const authHeader = buildOAuthHeader({
    method: 'POST',
    url: requestTokenUrl,
    oauthParams,
    consumerSecret: apiKeySecret,
  });

  const tokenRes = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: { Authorization: authHeader },
  });

  const tokenText = await tokenRes.text();

  if (!tokenRes.ok) {
    console.error('[Twitter Authorize] Request token failed:', tokenText);
    return NextResponse.json(
      { error: `Twitter request token failed (${tokenRes.status}): ${tokenText}` },
      { status: 500 }
    );
  }

  const tokenData = Object.fromEntries(new URLSearchParams(tokenText));

  if (!tokenData.oauth_token || tokenData.oauth_callback_confirmed !== 'true') {
    return NextResponse.json(
      { error: 'Twitter did not confirm the OAuth callback. Check your app callback URL setting.' },
      { status: 500 }
    );
  }

  // ── 4. Redirect the user to Twitter's authorization page ─────────────────
  // Store the request token secret in an httpOnly cookie so we can use it in
  // the callback to exchange for the permanent access token.
  const authorizeUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${tokenData.oauth_token}`;

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set('tw_req_token_secret', tokenData.oauth_token_secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — enough time for the user to authorize
    path: '/',
  });

  return response;
}