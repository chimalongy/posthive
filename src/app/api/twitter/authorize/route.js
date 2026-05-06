import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

/**
 * X API OAuth 2.0 Authorization Code Flow with PKCE
 * Required for v2 media upload endpoints (v1.1 media upload was deprecated June 2025)
 */

function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the record to find clientSecret
  const { data: record } = await supabase
    .from('connected_platforms')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'twitter')
    .single();

  if (!record || !record.credentials.clientSecret) {
    return NextResponse.json({ error: 'Twitter record not initialized correctly' }, { status: 400 });
  }

  // Generate PKCE parameters
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/twitter/callback`;

  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    clientId,
    codeVerifier
  })).toString('base64');

  const scope = [
    'tweet.read',
    'tweet.write',
    'users.read',
    'media.write',
    'offline.access'
  ].join(' ');

  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authUrl.toString());
}
