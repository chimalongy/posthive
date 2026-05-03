export async function postToYouTube(credentials, mediaUrl, caption) {
  const { clientId, clientSecret, refreshToken } = credentials;

  if (!clientId || !clientSecret || !refreshToken) {
    return { success: false, error: 'Missing YouTube OAuth credentials' };
  }

  try {
    // Step 1: Exchange refresh token for access token
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
      return { success: false, error: tokenData.error_description || tokenData.error || 'Failed to refresh YouTube token' };
    }

    const accessToken = tokenData.access_token;

    // Step 2: Fetch the video file as binary
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      return { success: false, error: 'Failed to fetch video file from storage' };
    }
    const videoBuffer = await videoRes.arrayBuffer();
    const videoBlob = new Blob([videoBuffer]);

    // Step 3: Initiate resumable upload
    const metadata = {
      snippet: {
        title: caption?.slice(0, 100) || 'PostHive Upload',
        description: caption || '',
      },
      status: { privacyStatus: 'public' },
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoBlob.size,
          'X-Upload-Content-Type': videoBlob.type || 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      return { success: false, error: `YouTube upload init failed: ${err}` };
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return { success: false, error: 'No upload URL returned from YouTube' };
    }

    // Step 4: Upload the video bytes
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': videoBlob.type || 'video/mp4',
        'Content-Length': videoBlob.size,
      },
      body: videoBlob,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || uploadData.error) {
      return { success: false, error: uploadData.error?.message || 'YouTube video upload failed' };
    }

    return { success: true, postId: uploadData.id };
  } catch (err) {
    return { success: false, error: err.message || 'YouTube API error' };
  }
}
