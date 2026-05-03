import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabaseServer';

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from('media_uploads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ media: data || [] });
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
      created_at: mediaData.created_at, // Ensure consistency with GET
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'posthive';

    // 1. Fetch paths to delete from storage
    const { data: filesToDelete, error: fetchError } = await supabase
      .from('media_uploads')
      .select('bucket_path')
      .in('id', ids)
      .eq('user_id', userId);

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (filesToDelete && filesToDelete.length > 0) {
      const paths = filesToDelete.map(f => f.bucket_path);
      
      // 2. Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove(paths);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // We continue to delete from DB even if storage fails, to avoid "ghost" records
      }
    }

    // 3. Delete from database
    const { error: dbError } = await supabase
      .from('media_uploads')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);

    if (dbError) {
      return Response.json({ error: dbError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Deletion failed' }, { status: 500 });
  }
}
