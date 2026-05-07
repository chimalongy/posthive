import { NextResponse } from 'next/server';
import { createClient as createUserClient } from '@/lib/supabaseServer';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// OAuth 1.0a helpers (shared pattern — same as authorize/route.js)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');
  const denied = searchParams.get('denied'); // set when the user clicks "Cancel" on Twitter

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  // ── Handle user-cancelled authorization ───────────────────────────────────
  if (denied) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/platforms?error=Twitter+authorization+was+cancelled`
    );
  }

  // ── Validate required params ───────────────────────────────────────────────
  const requestTokenSecret = request.cookies.get('tw_req_token_secret')?.value;

  if (!oauthToken || !oauthVerifier || !requestTokenSecret) {
    console.error('[Twitter Callback] Missing session data', {
      oauthToken: !!oauthToken,
      oauthVerifier: !!oauthVerifier,
      requestTokenSecret: !!requestTokenSecret,
    });
    return NextResponse.redirect(
      `${appUrl}/dashboard/platforms?error=Twitter+session+expired.+Please+try+connecting+again.`
    );
  }

  try {
    // ── 1. Identify the logged-in user ─────────────────────────────────────
    const supabaseUser = await createUserClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) throw new Error('User is not authenticated');

    // ── 2. Fetch the stored API credentials ────────────────────────────────
    // We use the service-role client here because the cookie-based session
    // may not be fully available in the callback redirect context.
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: record, error: fetchError } = await supabase
      .from('connected_platforms')
      .select('id, credentials')
      .eq('user_id', user.id)
      .eq('platform', 'twitter')
      .single();

    if (fetchError || !record) throw new Error('Twitter credential record not found in database');

    const { apiKey, apiKeySecret } = record.credentials;

    if (!apiKey || !apiKeySecret) {
      throw new Error('API Key or API Key Secret missing from stored credentials');
    }

    // ── 3. Exchange request token for permanent access token ───────────────
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';

    const oauthParams = {
      oauth_consumer_key: apiKey,
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
    };

    const authHeader = buildOAuthHeader({
      method: 'POST',
      url: accessTokenUrl,
      oauthParams,
      consumerSecret: apiKeySecret,
      tokenSecret: requestTokenSecret,
    });

    const tokenRes = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });

    const tokenText = await tokenRes.text();

    if (!tokenRes.ok) {
      console.error('[Twitter Callback] Access token exchange failed:', tokenText);
      throw new Error(`Twitter access token exchange failed (${tokenRes.status}): ${tokenText}`);
    }

    const tokenData = Object.fromEntries(new URLSearchParams(tokenText));

    if (!tokenData.oauth_token || !tokenData.oauth_token_secret) {
      throw new Error('Twitter did not return an access token. Response: ' + tokenText);
    }

    // ── 4. Persist the access token & mark the platform as active ──────────
    const updatedCredentials = {
      ...record.credentials,
      accessToken: tokenData.oauth_token,
      accessTokenSecret: tokenData.oauth_token_secret,
      screenName: tokenData.screen_name || null,
      twitterUserId: tokenData.user_id || null,
    };

    const { error: updateError } = await supabase
      .from('connected_platforms')
      .update({
        credentials: updatedCredentials,
        is_active: true,
        connected_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (updateError) throw new Error('Failed to save Twitter tokens: ' + updateError.message);

    // ── 5. Redirect back to the platforms page with a success message ───────
    const response = NextResponse.redirect(
      `${appUrl}/dashboard/platforms?success=Twitter+connected+successfully`
    );
    // Clear the temporary cookie
    response.cookies.set('tw_req_token_secret', '', { maxAge: 0, path: '/' });
    return response;

  } catch (err) {
    console.error('[Twitter Callback] Error:', err);
    const response = NextResponse.redirect(
      `${appUrl}/dashboard/platforms?error=${encodeURIComponent(err.message)}`
    );
    response.cookies.set('tw_req_token_secret', '', { maxAge: 0, path: '/' });
    return response;
  }
}