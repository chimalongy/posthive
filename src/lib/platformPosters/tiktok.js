export async function postToTikTok(credentials, mediaUrl, caption) {
  const { clientKey, clientSecret, accessToken, refreshToken, token_expires_at, isSandbox } = credentials;

  if (!clientKey || !clientSecret || !accessToken || !refreshToken) {
    return { success: false, error: 'Missing TikTok credentials' };
  }

  try {
    let currentAccessToken = accessToken;
    let currentRefreshToken = refreshToken;
    let updatedTokens = null;

    // Step 1: Check if token is expired or about to expire (within 10 minutes)
    const isExpired = !token_expires_at || Date.now() > (token_expires_at - 600000);

    if (isExpired) {
      console.log('TikTok access token expired or missing, refreshing...');
      const refreshRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      const refreshData = await refreshRes.json();
      
      // TikTok v2 returns { access_token, refresh_token, expires_in, ... } at root or inside .data depending on exact version
      // The guide shows them at the root of the JSON response for /v2/oauth/token/
      const data = refreshData;

      if (!refreshRes.ok || !data.access_token) {
        return { 
          success: false, 
          error: data.error_description || data.message || 'Failed to refresh TikTok token' 
        };
      }

      currentAccessToken = data.access_token;
      currentRefreshToken = data.refresh_token;
      updatedTokens = {
        accessToken: currentAccessToken,
        refreshToken: currentRefreshToken,
        token_expires_at: Date.now() + (data.expires_in * 1000)
      };
    }

    // Step 2: Initialize post
    // Guide: Sandbox uses /inbox/video/init/, Production uses /video/init/
    const endpointPath = isSandbox 
      ? 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'
      : 'https://open.tiktokapis.com/v2/post/publish/video/init/';

    const initRes = await fetch(endpointPath, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_info: {
          source: 'PULL_FROM_URL',
          url: mediaUrl,
        },
        post_info: {
          title: caption?.slice(0, 100) || 'PostHive Upload',
          privacy_level: 'SELF_ONLY', // Default for safety, Production can change this
        }
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok || initData.error?.code !== 'ok') {
      return { 
        success: false, 
        error: initData.error?.message || 'Failed to initialize TikTok post',
        updatedTokens // Return tokens even if post failed, so we don't lose the new refresh_token
      };
    }

    const publishId = initData.data?.publish_id;

    return { 
      success: true, 
      postId: publishId || 'pending', 
      error: isSandbox ? 'Post sent to your TikTok inbox as a draft (Sandbox Mode).' : null,
      updatedTokens
    };
  } catch (err) {
    return { success: false, error: err.message || 'TikTok API error' };
  }
}
