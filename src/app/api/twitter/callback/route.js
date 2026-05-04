import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createUserClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

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
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');
  const error = searchParams.get('denied');

  if (error) {
    return NextResponse.redirect(new URL('/dashboard/platforms?error=Twitter+connection+denied', request.url));
  }

  const tokenSecret = request.cookies.get('tw_token_secret')?.value;

  if (!oauthToken || !oauthVerifier || !tokenSecret) {
    return NextResponse.redirect(new URL('/dashboard/platforms?error=Missing+Twitter+session+data', request.url));
  }

  try {
    // 1. Initialize Supabase User Client to get current user
    const supabaseUser = await createUserClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    
    if (!user) throw new Error('Unauthorized');

    // 2. Initialize Supabase with service role to update record
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: record } = await supabase
      .from('connected_platforms')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'twitter')
      .single();

    if (!record) throw new Error('Twitter record not found');

    const { apiKey, apiKeySecret } = record.credentials;

    // 3. Exchange for Access Token
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

    const signature = buildSignature('POST', accessTokenUrl, oauthParams, apiKeySecret, tokenSecret);
    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(', ');

    const tokenRes = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: { Authorization: authHeader }
    });

    const tokenText = await tokenRes.text();
    const data = Object.fromEntries(new URLSearchParams(tokenText));

    if (!tokenRes.ok || !data.oauth_token) {
      throw new Error('Twitter access token exchange failed: ' + tokenText);
    }

    // 4. Update the record
    const updatedCredentials = {
      ...record.credentials,
      accessToken: data.oauth_token,
      accessTokenSecret: data.oauth_token_secret,
      screenName: data.screen_name,
      userId: data.user_id
    };

    await supabase
      .from('connected_platforms')
      .update({
        credentials: updatedCredentials,
        is_active: true,
        connected_at: new Date().toISOString()
      })
      .eq('id', record.id);

    const response = NextResponse.redirect(new URL('/dashboard/platforms?success=Twitter+connected', request.url));
    response.cookies.delete('tw_token_secret');
    return response;

  } catch (err) {
    console.error('Twitter Callback Error:', err);
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
