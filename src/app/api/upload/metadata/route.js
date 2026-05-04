import { createClient as createServerClient } from '@/lib/supabaseServer';

export async function POST(request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { file_name, file_type, bucket_path, public_url } = await request.json();

    if (!file_name || !file_type || !bucket_path || !public_url) {
      return Response.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const { data: mediaData, error: dbError } = await supabase
      .from('media_uploads')
      .insert({
        user_id: user.id,
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
