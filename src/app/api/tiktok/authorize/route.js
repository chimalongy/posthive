import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientKey = searchParams.get('client_key');
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
  // Scopes required for PostHive: user.info.basic, video.upload, video.publish
  const scope = 'user.info.basic,video.upload,video.publish';
  const responseType = 'code';
  
  // Use a fixed redirect URI that we'll implement next
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host');
  const redirectUri = `${protocol}://${host}/api/tiktok/callback`;

  // We use the 'state' parameter to pass the clientKey and isSandbox flag to the callback
  // In a production app, this should be a signed JWT or a CSRF token stored in a session
  const state = encodeURIComponent(JSON.stringify({
    userId: user.id,
    clientKey,
    isSandbox
  }));

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', responseType);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
