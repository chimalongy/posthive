import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createUserClient } from '@/lib/supabaseServer';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/dashboard/platforms?error=Missing+code+or+state', request.url));
  }

  try {
    // Base64 decode the state parameter
    const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
    const { userId, clientId, codeVerifier } = state;

    if (!userId || !clientId || !codeVerifier) {
      throw new Error('Invalid state parameters');
    }

    // Initialize Supabase with service role to update record
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: record } = await supabase
      .from('connected_platforms')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'twitter')
      .single();

    if (!record) throw new Error('Twitter record not found');

    const { clientSecret } = record.credentials;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/twitter/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Twitter Token Exchange Failed:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }

    // Update the record with OAuth 2.0 tokens
    const updatedCredentials = {
      ...record.credentials,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || record.credentials.refreshToken,
      token_expires_at: Date.now() + (tokenData.expires_in * 1000),
    };

    await supabase
      .from('connected_platforms')
      .update({
        credentials: updatedCredentials,
        is_active: true,
        connected_at: new Date().toISOString()
      })
      .eq('id', record.id);

    return NextResponse.redirect(new URL('/dashboard/platforms?success=Twitter+%2F+X+connected', request.url));

  } catch (err) {
    console.error('Twitter Callback Error:', err);
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
