import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId')?.trim();

  if (!appId) {
    return NextResponse.json({ error: 'Missing appId' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Required scopes for PostHive Facebook integration:
  // - pages_show_list: REQUIRED to list user's pages via /me/accounts (NOT deprecated)
  // - pages_manage_posts: post to pages
  // - pages_read_engagement: read page engagement data
  // - pages_manage_engagement: manage comments/reactions
  const scope = [
    'public_profile',
    'pages_show_list',
    'business_management',
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_manage_engagement',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/facebook/callback`;

  const state = JSON.stringify({
    userId: user.id,
    appId
  });

  const authUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  // Force Facebook to re-show the consent screen with ALL current permissions.
  // Without this, Facebook re-uses the previous token's permissions and skips
  // showing the dialog — so newly added scopes (like pages_show_list) are never granted.
  authUrl.searchParams.set('auth_type', 'rerequest');

  return NextResponse.redirect(authUrl.toString());
}
