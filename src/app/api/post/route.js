import { createClient as createServerClient } from '@/lib/supabaseServer';
import { postToFacebook } from '@/lib/platformPosters/facebook';
import { postToInstagram } from '@/lib/platformPosters/instagram';
import { postToYouTube } from '@/lib/platformPosters/youtube';
import { postToTikTok } from '@/lib/platformPosters/tiktok';
import { postToTwitter } from '@/lib/platformPosters/twitter';

export async function POST(request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const body = await request.json();
  const { media_id, caption, platforms } = body;

  if (!media_id || !caption || !platforms || platforms.length === 0) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: media } = await supabase
    .from('media_uploads')
    .select('*')
    .eq('id', media_id)
    .eq('user_id', userId)
    .single();

  if (!media) {
    return Response.json({ error: 'Media not found' }, { status: 404 });
  }

  const { data: credentials } = await supabase
    .from('connected_platforms')
    .select('*')
    .eq('user_id', userId)
    .in('platform', platforms)
    .eq('is_active', true);

  const credMap = {};
  credentials?.forEach((c) => { credMap[c.platform] = c.credentials; });

  const results = [];
  const isVideo = media.file_type?.startsWith('video/');
  // Generate a signed URL for all platforms (most require public access to pull media)
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'posthive';
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(media.bucket_path, 3600); // 1 hour expiry

  if (signedError) {
    return Response.json({ error: 'Failed to generate access URL for media: ' + signedError.message }, { status: 500 });
  }

  const mediaUrl = signedData.signedUrl;

  for (const platform of platforms) {
    const creds = credMap[platform];
    if (!creds) {
      results.push({ platform, success: false, error: 'No credentials found' });
      continue;
    }

    try {
      let result;
      switch (platform) {
        case 'facebook':
          result = await postToFacebook(creds, mediaUrl, caption, isVideo);
          break;
        case 'instagram':
          result = await postToInstagram(creds, mediaUrl, caption, isVideo);
          break;
        case 'youtube':
          if (!isVideo) {
            result = { success: false, error: 'YouTube only supports video uploads' };
          } else {
            result = await postToYouTube(creds, mediaUrl, caption);
          }
          break;
        case 'tiktok':
          if (!isVideo) {
            result = { success: false, error: 'TikTok only supports video uploads' };
          } else {
            result = await postToTikTok(creds, mediaUrl, caption);
            
            // If tokens were refreshed, save them immediately
            if (result?.updatedTokens) {
              const newCreds = { ...creds, ...result.updatedTokens };
              await supabase
                .from('connected_platforms')
                .update({ credentials: newCreds })
                .eq('user_id', userId)
                .eq('platform', 'tiktok');
              
              // Clean up result object for frontend
              delete result.updatedTokens;
            }
          }
          break;
        case 'twitter':
          result = await postToTwitter(creds, mediaUrl, caption, isVideo);
          break;
        default:
          result = { success: false, error: 'Unsupported platform' };
      }
      results.push({ platform, ...result });
    } catch (err) {
      results.push({ platform, success: false, error: err.message || 'Unknown error' });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const status = successCount === 0 ? 'failed' : successCount === platforms.length ? 'posted' : 'partial';

  const resultsJson = {};
  results.forEach((r) => {
    resultsJson[r.platform] = { success: r.success, postId: r.postId || null, error: r.error || null, note: r.note || null };
  });

  await supabase.from('posts').insert({
    user_id: userId,
    media_id,
    caption,
    platforms,
    status,
    results: resultsJson,
  });

  return Response.json({ results });
}
