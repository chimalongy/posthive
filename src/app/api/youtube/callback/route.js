import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const state = JSON.parse(decodeURIComponent(stateParam));
    const { userId, clientId } = state;

    if (!userId || !clientId) {
      throw new Error('Invalid state parameters');
    }

    // Initialize Supabase with service role to update the record
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get the existing credentials (specifically clientSecret)
    const { data: record, error: fetchError } = await supabase
      .from('connected_platforms')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .single();

    if (fetchError || !record) {
      throw new Error('Platform record not found. Please try again.');
    }

    const { clientSecret } = record.credentials;
    if (!clientSecret) {
      throw new Error('Client Secret not found in record.');
    }

    // 2. Exchange code for tokens
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/youtube/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }

    // 3. Update the record with full credentials
    const updatedCredentials = {
      ...record.credentials,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || record.credentials.refreshToken, // Google only sends refresh_token on first consent
      token_expires_at: Date.now() + (tokenData.expires_in * 1000),
    };

    const { error: updateError } = await supabase
      .from('connected_platforms')
      .update({
        credentials: updatedCredentials,
        is_active: true,
        connected_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (updateError) {
      throw updateError;
    }

    // 4. Redirect back to platforms with success
    return NextResponse.redirect(new URL('/dashboard/platforms?success=YouTube+connected', request.url));

  } catch (err) {
    console.error('YouTube Callback Error:', err);
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
