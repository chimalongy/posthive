import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabaseServer';

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { file_name, file_type, bucket_path, public_url } = await request.json();

    if (!file_name || !file_type || !bucket_path || !public_url) {
      return Response.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: mediaData, error: dbError } = await supabase
      .from('media_uploads')
      .insert({
        user_id: userId,
        file_name,
        file_type,
        bucket_path,
        public_url,
      })
      .select()
      .single();

    if (dbError) {
      return Response.json({ error: dbError.message }, { status: 500 });
    }

    return Response.json(mediaData);
  } catch (err) {
    return Response.json({ error: err.message || 'Metadata save failed' }, { status: 500 });
  }
}
