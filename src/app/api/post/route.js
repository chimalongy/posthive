import { postToFacebook } from '@/lib/platformPosters/facebook';
import { postToInstagram } from '@/lib/platformPosters/instagram';
import { postToTwitter } from '@/lib/platformPosters/twitter';
import { postToYouTube } from '@/lib/platformPosters/youtube';
import { postToTikTok } from '@/lib/platformPosters/tiktok';
import { createClient as createServerClient } from '@/lib/supabaseServer';

export async function POST(req) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { platforms: selectedPlatformNames, caption, media_id } = body;

    if (!selectedPlatformNames || !Array.isArray(selectedPlatformNames) || selectedPlatformNames.length === 0) {
      return new Response(JSON.stringify({ error: 'No platforms selected' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Fetch Media details
    let mediaUrl = null;
    let isVideo = false;
    let mediaType = 'image/jpeg';

    if (media_id) {
      const { data: mediaData, error: mediaError } = await supabase
        .from('media_uploads')
        .select('*')
        .eq('id', media_id)
        .single();
      
      if (mediaError || !mediaData) {
        return new Response(JSON.stringify({ error: 'Media not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      
      mediaUrl = mediaData.public_url;
      mediaType = mediaData.file_type;
      isVideo = mediaType?.startsWith('video/');
    }

    // 2. Fetch User's Connected Platforms
    const { data: connectedPlatforms, error: platformsError } = await supabase
      .from('connected_platforms')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    if (platformsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch connected platforms' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const results = [];

    // 3. Process each selected platform
    for (const platformName of selectedPlatformNames) {
      const platformRecord = connectedPlatforms.find(p => p.platform === platformName);

      if (!platformRecord) {
        results.push({ platform: platformName, success: false, error: 'Platform not connected or inactive.' });
        continue;
      }

      const creds = platformRecord.credentials;
      let result;

      try {
        switch (platformName) {
          case 'facebook':
            result = await postToFacebook(creds, mediaUrl, caption, isVideo, mediaType);
            break;
          case 'instagram':
            result = await postToInstagram(creds, mediaUrl, caption, isVideo, mediaType);
            break;
          case 'twitter':
            result = await postToTwitter(creds, mediaUrl, caption, isVideo);
            break;
          case 'youtube':
            result = await postToYouTube(creds, mediaUrl, caption, mediaType);
            break;
          case 'tiktok':
            result = await postToTikTok(creds, mediaUrl, caption, mediaType);
            break;
          default:
            results.push({ platform: platformName, success: false, error: `Unsupported platform: ${platformName}` });
            continue;
        }

        // Attach platform name to result for front-end
        results.push({ ...result, platform: platformName });

        // Update tokens if they were refreshed
        if (result.updatedTokens) {
          const updated = { ...creds, ...result.updatedTokens };
          await supabase
            .from('connected_platforms')
            .update({ credentials: updated })
            .eq('id', platformRecord.id);
        }
      } catch (err) {
        console.error(`Posting error for ${platformName}:`, err);
        results.push({ platform: platformName, success: false, error: err.message || 'Unexpected error occurred.' });
      }
    }

    // 4. Save the post record to the database
    const allSucceeded = results.every(r => r.success);
    const allFailed = results.every(r => !r.success);
    const postStatus = allSucceeded ? 'posted' : allFailed ? 'failed' : 'partial';

    const resultsMap = {};
    results.forEach(r => { resultsMap[r.platform] = r; });

    await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        media_id: media_id || null,
        caption: caption || '',
        platforms: selectedPlatformNames,
        status: postStatus,
        results: resultsMap,
      });

    return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Post API Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
