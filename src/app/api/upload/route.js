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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name;
    const fileType = file.type;
    const timestamp = Date.now();
    const path = `${userId}/${timestamp}_${fileName}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'posthive';

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, file, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;

    const { data: mediaData, error: dbError } = await supabase
      .from('media_uploads')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        bucket_path: path,
        public_url: publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      return Response.json({ error: dbError.message }, { status: 500 });
    }

    return Response.json({
      id: mediaData.id,
      file_name: fileName,
      file_type: fileType,
      public_url: publicUrl,
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
