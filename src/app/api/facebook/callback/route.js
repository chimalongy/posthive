import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/platforms?error=Missing+code+or+state', request.url));
  }

  try {
    const stateData = JSON.parse(decodeURIComponent(state));
    const { userId, appId } = stateData;

    if (!userId || !appId) {
      throw new Error('Invalid state parameters');
    }

    // Fetch appSecret from the database — it was saved during the connect step.
    // We intentionally do NOT pass secrets through URL state parameters.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: platformRecord, error: fetchError } = await supabase
      .from('connected_platforms')
      .select('credentials')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single();

    if (fetchError || !platformRecord?.credentials?.appSecret) {
      throw new Error('Facebook credentials not found. Please save your App ID and App Secret first.');
    }

    const appSecret = platformRecord.credentials.appSecret;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/facebook/callback`;

    // Step 1: Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Token exchange failed');
    }

    const shortToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token (60 days)
    const longTokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json();

    if (!longTokenRes.ok || !longTokenData.access_token) {
      throw new Error(longTokenData.error?.message || 'Failed to get long-lived token');
    }

    const longToken = longTokenData.access_token;

    // Step 3: Get user info
    const meUrl = `https://graph.facebook.com/v22.0/me?access_token=${longToken}`;
    const meRes = await fetch(meUrl);
    const meData = await meRes.json();
    if (!meRes.ok) throw new Error(meData.error?.message || 'Failed to get user info');
    const userFacebookId = meData.id;

    // Step 4: Get pages — requires pages_show_list scope.
    // Explicitly request fields so Facebook doesn't omit access_token.
    const pagesUrl = `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,tasks&access_token=${longToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    // Log the raw response to help diagnose permission issues
    console.log('[Facebook Callback] /me/accounts response:', JSON.stringify(pagesData));

    if (!pagesRes.ok) {
      throw new Error(`Facebook API error fetching pages: ${pagesData.error?.message || JSON.stringify(pagesData)}`);
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      // Fallback: check if the user manually provided pageId & pageAccessToken
      // during the credential-entry step (the optional fields in CredentialModal).
      const manualPageId = platformRecord.credentials.pageId;
      const manualPageToken = platformRecord.credentials.pageAccessToken;

      if (manualPageId && manualPageToken) {
        console.log('[Facebook Callback] Auto-detection returned no pages — using manually provided pageId/pageAccessToken.');
        const facebookCredentials = {
          ...platformRecord.credentials,
          accessToken: longToken,
          pageAccessToken: manualPageToken,
          pageId: manualPageId,
          userId: userFacebookId,
          token_expires_at: Date.now() + 5184000000, // 60 days
        };

        await supabase
          .from('connected_platforms')
          .update({
            credentials: facebookCredentials,
            is_active: true,
            connected_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('platform', 'facebook');

        return NextResponse.redirect(
          new URL('/dashboard/platforms?success=Facebook+connected+(manual+page)', request.url)
        );
      }

      // No manual fallback available — throw with diagnostic info
      throw new Error(
        `No Facebook Pages returned (raw response: ${JSON.stringify(pagesData)}). ` +
        'Make sure: (1) your Facebook app is in Development mode, ' +
        '(2) you have at least one Facebook Page where you are an Admin, ' +
        '(3) you granted all permissions on the consent screen, ' +
        '(4) if your Page is under a Business Manager, grant the "business_management" permission.'
      );
    }

    // Step 5: Build page list with instagram accounts
    const pages = [];
    for (const page of pagesData.data) {
      const pageToken = page.access_token;
      const pageId = page.id;
      const pageName = page.name;

      // Check for linked Instagram Business Account
      let instagramAccount = null;
      try {
        const igUrl = `https://graph.facebook.com/v22.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`;
        const igRes = await fetch(igUrl);
        const igData = await igRes.json();
        if (igRes.ok && igData.instagram_business_account) {
          instagramAccount = igData.instagram_business_account;
          console.log(`Found Instagram Business Account ${instagramAccount.id} linked to Page ${pageName}`);
        }
      } catch (e) {
        console.warn(`Could not check Instagram for page ${pageName}:`, e.message);
      }

      pages.push({
        id: pageId,
        name: pageName,
        access_token: pageToken,
        instagram_business_account: instagramAccount,
      });
    }

    const pageToken = pages[0].access_token;
    const pageId = pages[0].id;
    const pageName = pages[0].name;

    // Step 6: Update Facebook record (reusing the supabase client from above)
    const facebookCredentials = {
      appId,
      appSecret,
      accessToken: longToken,
      pageAccessToken: pageToken,
      pageId,
      pageName,
      pages,
      userId: userFacebookId,
      token_expires_at: Date.now() + 5184000000, // 60 days
    };

    const { data: existingFb } = await supabase
      .from('connected_platforms')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single();

    if (existingFb) {
      await supabase
        .from('connected_platforms')
        .update({
          credentials: facebookCredentials,
          is_active: true,
          connected_at: new Date().toISOString()
        })
        .eq('id', existingFb.id);
    } else {
      await supabase
        .from('connected_platforms')
        .insert({
          user_id: userId,
          platform: 'facebook',
          credentials: facebookCredentials,
          is_active: true,
          connected_at: new Date().toISOString()
        });
    }

    // Step 8: Auto-connect Instagram if linked
    const linkedPage = pages.find(p => p.instagram_business_account);
    if (linkedPage) {
      const igCredentials = {
        igBusinessAccountId: linkedPage.instagram_business_account.id,
        pageAccessToken: linkedPage.access_token,
        pageId: linkedPage.id,
        pageName: linkedPage.name,
        token_expires_at: facebookCredentials.token_expires_at,
      };

      const { data: existingIg } = await supabase
        .from('connected_platforms')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'instagram')
        .single();

      if (existingIg) {
        await supabase
          .from('connected_platforms')
          .update({
            credentials: igCredentials,
            is_active: true,
            connected_at: new Date().toISOString()
          })
          .eq('id', existingIg.id);
      } else {
        await supabase
          .from('connected_platforms')
          .insert({
            user_id: userId,
            platform: 'instagram',
            credentials: igCredentials,
            is_active: true,
            connected_at: new Date().toISOString()
          });
      }

      return NextResponse.redirect(new URL('/dashboard/platforms?success=Facebook+and+Instagram+connected', request.url));
    }

    return NextResponse.redirect(new URL('/dashboard/platforms?success=Facebook+connected', request.url));
  } catch (err) {
    console.error('Facebook Callback Error:', err);
    return NextResponse.redirect(new URL(`/dashboard/platforms?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
