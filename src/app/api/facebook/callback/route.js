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
    const { userId, appId } = state;

    if (!userId || !appId) {
      throw new Error('Invalid state parameters');
    }

    // 1. Initialize Supabase with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: record, error: fetchError } = await supabase
      .from('connected_platforms')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single();

    if (fetchError || !record) {
      throw new Error('Platform record not found. Please try again.');
    }

    const { appSecret } = record.credentials;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/facebook/callback`;

    // 2. Exchange code for Short-Lived User Access Token
    const tokenRes = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error?.message || 'Failed to exchange code');

    const shortToken = tokenData.access_token;

    // 3. Exchange for Long-Lived User Access Token (60 days)
    const longTokenRes = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`);
    const longTokenData = await longTokenRes.json();
    if (!longTokenRes.ok) throw new Error(longTokenData.error?.message || 'Failed to get long-lived token');

    const longToken = longTokenData.access_token;

    // 4. Get User's Pages and Page Access Tokens
    const pagesRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) throw new Error(pagesData.error?.message || 'Failed to fetch pages');

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook Pages found for this account.');
    }

    // For now, we pick the first page. 
    // In the future, we could show a UI for the user to select one.
    const primaryPage = pagesData.data[0];

    // 5. Update the record
    const updatedCredentials = {
      ...record.credentials,
      userAccessToken: longToken,
      pageAccessToken: primaryPage.access_token,
      pageId: primaryPage.id,
      pageName: primaryPage.name,
      connected_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('connected_platforms')
      .update({
        credentials: updatedCredentials,
        is_active: true,
        connected_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (updateError) throw updateError;

    return NextResponse.redirect(new URL('/dashboard/platforms?success=Facebook+Page+connected', request.url));

  } catch (err) {
    console.error('Facebook Callback Error:', err);
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
