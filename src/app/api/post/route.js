import { postToFacebook } from '@/lib/platformPosters/facebook';
import { postToInstagram } from '@/lib/platformPosters/instagram';
import { postToTwitter } from '@/lib/platformPosters/twitter';
import { postToYouTube } from '@/lib/platformPosters/youtube';
import { postToTikTok } from '@/lib/platformPosters/tiktok';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { platforms, content, caption, mediaUrl, isVideo, mediaType } = body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return new Response(JSON.stringify({ error: 'No platforms selected' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!content && !mediaUrl && !caption) {
      return new Response(JSON.stringify({ error: 'No content provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const results = {};

    for (const platform of platforms) {
      const creds = platform.credentials;
      const platformName = platform.platform;

      if (!creds) {
        results[platformName] = { success: false, error: 'No credentials found for this platform.' };
        continue;
      }

      let result;

      try {
        switch (platformName) {
          case 'facebook':
            result = await postToFacebook(creds, mediaUrl, caption || content, isVideo, mediaType);
            break;
          case 'instagram':
            result = await postToInstagram(creds, mediaUrl, caption || content, isVideo, mediaType);
            break;
          case 'twitter':
            result = await postToTwitter(creds, mediaUrl, caption || content, isVideo, mediaType);
            break;
          case 'youtube':
            result = await postToYouTube(creds, mediaUrl, caption || content, mediaType);
            break;
          case 'tiktok':
            result = await postToTikTok(creds, mediaUrl, caption || content, mediaType);
            break;
          default:
            results[platformName] = { success: false, error: `Unsupported platform: ${platformName}` };
            continue;
        }

        results[platformName] = result;
      } catch (err) {
        console.error(`Posting error for ${platformName}:`, err);
        results[platformName] = { success: false, error: err.message || 'Unexpected error occurred while posting.' };
      }
    }

    // Persist any refreshed tokens back to Supabase
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        for (const platform of platforms) {
          const platformName = platform.platform;
          const result = results[platformName];
          if (result?.updatedTokens && platform.id) {
            const { data: existing } = await supabase
              .from('connected_platforms')
              .select('credentials')
              .eq('id', platform.id)
              .single();
            if (existing) {
              const updated = { ...existing.credentials, ...result.updatedTokens };
              await supabase.from('connected_platforms').update({ credentials: updated }).eq('id', platform.id);
            }
          }
        }
      }
    } catch (persistErr) {
      console.error('Token persist error:', persistErr);
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Post API Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
