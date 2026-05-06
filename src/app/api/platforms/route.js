import { createClient as createServerClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const { data, error } = await supabase
    .from('connected_platforms')
    .select('id, platform, connected_at, is_active, credentials')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ platforms: data || [] });
}

export async function POST(request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const body = await request.json();
  const { platform, credentials } = body;

  if (!platform || !credentials) {
    return Response.json({ error: 'Missing platform or credentials' }, { status: 400 });
  }

  // Trim all string credential values to prevent space-related errors
  const trimmedCredentials = {};
  for (const [key, value] of Object.entries(credentials)) {
    trimmedCredentials[key] = typeof value === 'string' ? value.trim() : value;
  }

  const { data: existing } = await supabase
    .from('connected_platforms')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('connected_platforms')
      .update({ credentials: trimmedCredentials, is_active: true, connected_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('connected_platforms')
      .insert({ user_id: userId, platform, credentials: trimmedCredentials });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (platform === 'facebook') {
    const redirectUrl = `/api/facebook/authorize?appId=${encodeURIComponent(trimmedCredentials.appId)}`;
    return Response.json({ success: true, redirectUrl });
  }

  if (platform === 'tiktok') {
    const redirectUrl = `/api/tiktok/authorize?client_key=${encodeURIComponent(trimmedCredentials.clientKey)}&is_sandbox=${trimmedCredentials.isSandbox}`;
    return Response.json({ success: true, redirectUrl });
  }

  if (platform === 'youtube') {
    const redirectUrl = `/api/youtube/authorize?clientId=${encodeURIComponent(trimmedCredentials.clientId)}`;
    return Response.json({ success: true, redirectUrl });
  }

  if (platform === 'twitter') {
    const redirectUrl = `/api/twitter/authorize?clientId=${encodeURIComponent(trimmedCredentials.clientId)}`;
    return Response.json({ success: true, redirectUrl });
  }

  return Response.json({ success: true });
}

export async function DELETE(request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return Response.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('connected_platforms')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
