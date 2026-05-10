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

  // Construct Facebook OAuth URL
  // pages_show_list is deprecated in Graph API v22.0
  // pages_manage_posts & pages_read_engagement require App Review for Live apps
  const scope = [
    'public_profile',
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_manage_engagement',
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

  return NextResponse.redirect(authUrl.toString());
}
