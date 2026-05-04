import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

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

  // Construct Google OAuth URL
  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
  ].join(' ');
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/youtube/callback`;

  const state = JSON.stringify({
    userId: user.id,
    clientId
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force consent to ensure refresh_token is returned
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
