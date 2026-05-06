/**
 * Instagram Graph API Poster
 * Uses the latest v22.0 endpoints for Business/Creator accounts.
 * Implements proper container status polling for video/reel uploads.
 */

const API_VERSION = 'v22.0';
const GRAPH_API = `https://graph.facebook.com/${API_VERSION}`;

async function pollContainerStatus(pageAccessToken, creationId, timeoutMs = 120000) {
  const start = Date.now();
  const interval = 3000;

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${GRAPH_API}/${creationId}?fields=status_code&access_token=${pageAccessToken}`);
    const data = await res.json();

    if (!res.ok && data.error) {
      throw new Error(data.error.message || 'Instagram container status check failed');
    }

    const status = data.status_code;
    console.log(`Instagram container ${creationId} status: ${status}`);

    if (status === 'FINISHED') {
      return true;
    }
    if (status === 'ERROR') {
      throw new Error('Instagram media processing failed');
    }
    if (status === 'IN_PROGRESS' || status === 'PENDING') {
      await new Promise(r => setTimeout(r, interval));
      continue;
    }
    // Unknown status, wait and retry
    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error('Instagram media processing timed out. The container did not finish within the expected time.');
}

export async function postToInstagram(credentials, mediaUrl, caption, isVideo, mediaType) {
  const { igBusinessAccountId, pageAccessToken, pageId } = credentials;

  if (!igBusinessAccountId || !pageAccessToken) {
    return { success: false, error: 'Missing Instagram Business Account ID or Page Access Token. Connect Facebook first to auto-link Instagram.' };
  }

  try {
    console.log(`Posting to Instagram Business Account ${igBusinessAccountId} (${isVideo || mediaType === 'video' ? 'video/reel' : 'image'})...`);

    let creationId;

    if (isVideo || mediaType === 'video') {
      // Step 1: Create video container
      const createRes = await fetch(`${GRAPH_API}/${igBusinessAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: mediaUrl,
          caption,
          access_token: pageAccessToken,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        return { success: false, error: createData.error?.message || 'Instagram media container creation failed' };
      }

      creationId = createData.id;

      // Step 2: Poll container status
      try {
        await pollContainerStatus(pageAccessToken, creationId);
      } catch (pollErr) {
        return { success: false, error: pollErr.message || 'Instagram video processing failed' };
      }
    } else {
      // Image: create then publish
      const createRes = await fetch(`${GRAPH_API}/${igBusinessAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: mediaUrl,
          caption,
          access_token: pageAccessToken,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        return { success: false, error: createData.error?.message || 'Instagram media container creation failed' };
      }

      creationId = createData.id;

      // For images, a short poll is still safest
      try {
        await pollContainerStatus(pageAccessToken, creationId, 60000);
      } catch {
        // Images often publish immediately; if polling fails, we can still try to publish
        console.warn('Instagram image container polling timed out, attempting publish anyway');
      }
    }

    // Step 3: Publish
    const publishRes = await fetch(`${GRAPH_API}/${igBusinessAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: pageAccessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      return { success: false, error: publishData.error?.message || 'Instagram publishing failed' };
    }

    return { success: true, postId: publishData.id };
  } catch (err) {
    console.error('Instagram Poster Exception:', err);
    return { success: false, error: err.message || 'Instagram API error' };
  }
}
