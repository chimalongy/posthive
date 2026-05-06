'use client';

import { useState } from 'react';
import { X, ExternalLink, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

const guides = {
  facebook: {
    name: 'Facebook',
    steps: [
      {
        title: 'Create a Meta Developer Account',
        desc: 'Go to developers.facebook.com and sign in with your Facebook account.',
        link: 'https://developers.facebook.com/',
      },
      {
        title: 'Create a Meta App',
        desc: 'Click "My Apps → Create App". Select "Business" as the app type. Enter your app name and contact email.',
        link: 'https://developers.facebook.com/apps/',
      },
      {
        title: 'Add Facebook Login Product',
        desc: 'In your app dashboard, go to "Add Products" and add "Facebook Login".',
      },
      {
        title: 'Configure OAuth Settings',
        desc: 'Add your redirect URI: {redirectUri} under "Valid OAuth Redirect URIs" in Facebook Login → Settings.',
      },
      {
        title: 'Add Required Permissions',
        desc: 'In "App Review → Permissions and Features", request: pages_show_list, pages_manage_posts, pages_read_engagement.',
      },
      {
        title: 'Get App Credentials',
        desc: 'Go to "Settings → Basic". Copy the App ID and App Secret. Paste them into PostHive and click "Save & Authorize".',
      },
      {
        title: 'Select Your Facebook Page',
        desc: 'After authorization, you will be asked to select the Facebook Page you want to connect.',
      },
    ],
  },
  instagram: {
    name: 'Instagram',
    steps: [
      {
        title: 'Prerequisite: Connect Facebook First',
        desc: 'Instagram requires a Facebook Page connection. You must connect Facebook before Instagram.',
      },
      {
        title: 'Convert to Business Account',
        desc: 'In the Instagram app, go to Settings → Account → Switch to Professional Account → Business.',
      },
      {
        title: 'Link to Facebook Page',
        desc: 'In Instagram Settings → Account → Linked Accounts → Facebook, link your Instagram to a Facebook Page.',
      },
      {
        title: 'Get Required Permissions',
        desc: 'In your Meta App, request these permissions via App Review: instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement.',
      },
      {
        title: 'Auto-Connect via Facebook',
        desc: 'Once Facebook is connected in PostHive, we will automatically detect your linked Instagram Business Account and enable Instagram posting.',
      },
    ],
  },
  youtube: {
    name: 'YouTube',
    steps: [
      {
        title: 'Create a Google Cloud Project',
        desc: 'Go to Google Cloud Console and create a new project.',
        link: 'https://console.cloud.google.com/projectcreate',
      },
      {
        title: 'Enable YouTube Data API v3',
        desc: 'In API & Services → Library, search for "YouTube Data API v3" and click Enable.',
        link: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
      },
      {
        title: 'Create OAuth 2.0 Credentials',
        desc: 'Go to API & Services → Credentials → Create Credentials → OAuth client ID. Select "Web application".',
        link: 'https://console.cloud.google.com/apis/credentials',
      },
      {
        title: 'Add Authorized Redirect URI',
        desc: 'Add this exact URI to "Authorized redirect URIs": {redirectUri}',
      },
      {
        title: 'Get Client ID & Secret',
        desc: 'Copy the Client ID and Client Secret from the credentials page. Paste them into PostHive and click "Save & Authorize".',
      },
      {
        title: 'Consent Screen Setup',
        desc: 'If prompted, configure the OAuth consent screen. For testing, add your email as a test user.',
      },
    ],
  },
  tiktok: {
    name: 'TikTok',
    steps: [
      {
        title: 'Create a TikTok Developer Account',
        desc: 'Go to developers.tiktok.com and sign in with your TikTok account.',
        link: 'https://developers.tiktok.com/',
      },
      {
        title: 'Create a New App',
        desc: 'Click "Create App" and fill in the app details. Choose "Web" as the platform.',
      },
      {
        title: 'Configure Redirect URI',
        desc: 'In your app settings, add this redirect URI: {redirectUri}',
      },
      {
        title: 'Request Required Scopes',
        desc: 'Ensure your app has these scopes enabled: user.info.basic, video.upload, video.publish.',
      },
      {
        title: 'Add Sandbox Users (Optional)',
        desc: 'For testing before app review, add your TikTok account under "Sandbox" in the Developer Portal. Enable "Test Mode (Sandbox)" in PostHive.',
        link: 'https://developers.tiktok.com/doc/add-a-sandbox',
      },
      {
        title: 'Get App Credentials',
        desc: 'Copy the Client Key and Client Secret from the app dashboard. Paste them into PostHive and click "Save & Authorize".',
      },
    ],
  },
  twitter: {
    name: 'Twitter / X',
    steps: [
      {
        title: 'Apply for X Developer Account',
        desc: 'Go to developer.x.com and apply for a developer account. You need at least the Basic tier to post with media.',
        link: 'https://developer.x.com/',
      },
      {
        title: 'Create a New App',
        desc: 'In the X Developer Portal, go to Projects & Apps → Create App. Give it a name.',
        link: 'https://developer.x.com/en/portal/projects-and-apps',
      },
      {
        title: 'Enable OAuth 2.0',
        desc: 'In your app settings, enable "OAuth 2.0" under the Authentication section. Set app type to "Web App" (confidential client).',
      },
      {
        title: 'Configure Callback URL',
        desc: 'Add this exact callback URL: {redirectUri} under "OAuth 2.0 settings".',
      },
      {
        title: 'Set Required Scopes',
        desc: 'Ensure these scopes are selected: tweet.read, tweet.write, users.read, media.write, offline.access.',
      },
      {
        title: 'Get Client ID & Secret',
        desc: 'Copy the Client ID and Client Secret from "Keys and Tokens". Paste them into PostHive and click "Save & Authorize".',
      },
    ],
  },
};

export default function ConnectionGuideModal({ platform, onClose }) {
  const guide = guides[platform];
  const [openSteps, setOpenSteps] = useState(new Set([0]));

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/${platform}/callback`;

  const toggleStep = (index) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">How to Connect {guide.name}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Follow these steps to get your API credentials.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {guide.steps.map((step, index) => {
            const isOpen = openSteps.has(index);
            const desc = step.desc.replace('{redirectUri}', redirectUri);
            return (
              <div
                key={index}
                className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleStep(index)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{step.title}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="pl-9 text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                      <p>{desc}</p>
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium"
                        >
                          Open in browser
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p>
              Once you have your credentials, close this guide and click the <strong>Connect</strong> button on the
              platform card to enter them.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-medium text-sm transition-colors"
          >
            Got it, let&apos;s connect
          </button>
        </div>
      </div>
    </div>
  );
}
