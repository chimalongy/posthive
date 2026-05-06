// PostHive — Complete YouTube poster (Resumable Chunked Upload)
// Following Google's best practices for the YouTube Data API v3.

/**
 * Main export for PostHive
 */
export async function postToYouTube(credentials, mediaUrl, caption) {
  const { clientId, clientSecret, refreshToken } = credentials;

  if (!clientId || !clientSecret || !refreshToken) {
    return { success: false, error: 'Missing YouTube OAuth credentials' };
  }

  try {
    // Step 1: Exchange refresh token for access token
    console.log('Refreshing YouTube access token...');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      return { 
        success: false, 
        error: `YouTube Auth Error: ${tokenData.error_description || tokenData.error}` 
      };
    }

    const accessToken = tokenData.access_token;

    // Step 2: Fetch the video file as binary
    console.log('Fetching video from storage...');
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      return { success: false, error: 'Failed to fetch video file from storage' };
    }
    const videoBuffer = await videoRes.arrayBuffer();
    const videoSize = videoBuffer.byteLength;

    // Step 3: Initiate resumable upload
    console.log('Initiating YouTube resumable upload...');
    const metadata = {
      snippet: {
        title: caption?.slice(0, 100) || 'PostHive Upload',
        description: caption || '',
        categoryId: '22', // Default: People & Blogs
      },
      status: { 
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      },
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(videoSize),
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.json();
      const errorMessage = err.error?.message || 'Initialization failed';
      if (errorMessage.includes('quota')) {
        return { success: false, error: 'YouTube API quota exceeded. Please try again tomorrow.' };
      }
      return { success: false, error: `YouTube Init Error: ${errorMessage}` };
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return { success: false, error: 'No upload session URL returned from YouTube' };
    }

    // Step 4: Upload the video bytes in chunks (Multiple of 256KB)
    console.log('Transferring video to YouTube in chunks...');
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks (must be multiple of 256KB)
    const totalChunks = Math.ceil(videoSize / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoSize);
      const chunk = videoBuffer.slice(start, end);

      console.log(`Uploading YouTube chunk ${i + 1}/${totalChunks} (${chunk.byteLength} bytes)...`);
      
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end - 1}/${videoSize}`,
        },
        body: chunk,
      });

      // 308 Resume Incomplete is expected for intermediate chunks
      if (uploadRes.status === 308) {
        continue;
      }

      // Success (final chunk)
      if (uploadRes.ok) {
        const finalData = await uploadRes.json();
        return { success: true, postId: finalData.id };
      }

      // Error
      const errorData = await uploadRes.json();
      return { 
        success: false, 
        error: errorData.error?.message || `Upload failed at chunk ${i + 1}` 
      };
    }

    return { success: false, error: 'Upload ended prematurely' };
  } catch (err) {
    console.error('YouTube Poster Error:', err);
    return { success: false, error: err.message || 'YouTube API error' };
  }
}
