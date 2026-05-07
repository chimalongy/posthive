'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, ExternalLink, AlertTriangle } from 'lucide-react';

const platformConfig = {
  facebook: {
    name: 'Facebook',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text', help: 'https://developers.facebook.com/apps/' },
      { key: 'appSecret', label: 'App Secret', type: 'password', help: 'https://developers.facebook.com/apps/' },
    ],
    warning: 'Facebook requires OAuth authorization. Enter your App credentials from the Meta for Developers portal, then click "Save & Authorize". You will be asked to select the Page you want to connect.',
  },
  instagram: {
    name: 'Instagram',
    fields: [],
    warning: 'Instagram is connected automatically when you link a Facebook Page that has an Instagram Business account connected. Please connect Facebook first.',
    noCredentials: true,
  },
  youtube: {
    name: 'YouTube',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', help: 'https://console.cloud.google.com/apis/credentials' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', help: 'https://console.cloud.google.com/apis/credentials' },
    ],
    warning: 'YouTube requires OAuth authorization. Ensure you have enabled the "YouTube Data API v3" in your Google Cloud Console and added your Redirect URI to the Credentials page.',
  },
  tiktok: {
    name: 'TikTok',
    fields: [
      { key: 'clientKey', label: 'Client Key', type: 'text', help: 'https://developers.tiktok.com/' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', help: 'https://developers.tiktok.com/' },
      { key: 'isSandbox', label: 'Test Mode (Sandbox)', type: 'checkbox', help: 'https://developers.tiktok.com/doc/add-a-sandbox' },
    ],
    warning: 'TikTok requires OAuth authorization. Enter your app credentials from the TikTok Developer Portal, then click "Save & Authorize" to connect your account.',
  },
  twitter: {
    name: 'Twitter / X',
    fields: [
      { key: 'clientId', label: 'Client ID (OAuth 2.0)', type: 'text', help: 'https://developer.x.com/en/portal/projects-and-apps' },
      { key: 'clientSecret', label: 'Client Secret (OAuth 2.0)', type: 'password', help: 'https://developer.x.com/en/portal/projects-and-apps' },
    ],
    warning: 'Twitter / X now requires OAuth 2.0 for media uploads. Enter your OAuth 2.0 Client ID and Secret from the X Developer Portal, then click "Save & Authorize". Ensure your App has "Read and Write" permissions and the media.write scope enabled in the OAuth 2.0 settings.',
  },
};

export default function CredentialModal({ platform, onSave, onClose }) {
  const config = platformConfig[platform];
  const [values, setValues] = useState(() => {
    const init = {};
    config.fields.forEach((f) => (init[f.key] = ''));
    return init;
  });
  const [showPassword, setShowPassword] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleShow = (key) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const empty = config.fields.find((f) => {
      const val = values[f.key];
      if (f.type === 'checkbox') return false; // Checkboxes are always filled (true/false)
      return !val?.trim();
    });
    if (empty) {
      setError(`Please fill in all fields (${empty.label} is empty).`);
      return;
    }
    setLoading(true);
    try {
      const result = await onSave(values);
      if (result?.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Connect {config.name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Important</p>
            <p>{config.warning}</p>
          </div>
        </div>

        {config.noCredentials ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Instagram posting is handled through your Facebook Page connection. Once Facebook is connected and your Page has a linked Instagram Business account, Instagram will appear as connected automatically.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-medium text-sm transition-colors"
            >
              Understood
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">{field.label}</label>
                <a
                  href={field.help}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  Where do I find this?
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                {field.type === 'checkbox' ? (
                  <div className="flex items-center gap-2 py-1">
                    <input
                      id={`field-${field.key}`}
                      type="checkbox"
                      checked={values[field.key] === true}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={`field-${field.key}`} className="text-sm text-zinc-600 dark:text-zinc-400">
                      Enabled
                    </label>
                  </div>
                ) : (
                  <>
                    <input
                      type={showPassword[field.key] ? 'text' : field.type}
                      value={values[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 pr-10 text-sm bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder={`Enter your ${field.label}`}
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() => toggleShow(field.key)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showPassword[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="pt-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Your API credentials are stored securely. Treat them like passwords.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : (platform === 'tiktok' || platform === 'youtube' || platform === 'twitter' || platform === 'facebook') ? 'Save & Authorize' : 'Save Credentials'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
