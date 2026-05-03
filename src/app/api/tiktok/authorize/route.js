import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientKey = searchParams.get('client_key')?.trim();
  const isSandbox = searchParams.get('is_sandbox') === 'true';

  if (!clientKey) {
    return NextResponse.json({ error: 'Missing client_key' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Construct TikTok Authorization URL
  // Scopes required for PostHive: user.info.basic,video.upload,video.publish
  const scope = 'user.info.basic,video.upload,video.publish';
  const responseType = 'code';
  
  // Use the APP_URL from environment variables for the redirect URI
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/tiktok/callback`;

  // Simplify state - URLSearchParams.set will handle the encoding
  const state = JSON.stringify({
    userId: user.id,
    clientKey,
    isSandbox
  });

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', responseType);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
