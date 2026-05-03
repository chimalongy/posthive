'use client';

import { Globe, Camera, Play, Music2, MessageSquare, AlertTriangle } from 'lucide-react';

const platforms = [
  { key: 'facebook', name: 'Facebook', icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  { key: 'instagram', name: 'Instagram', icon: Camera, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800' },
  { key: 'youtube', name: 'YouTube', icon: Play, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  { key: 'tiktok', name: 'TikTok', icon: Music2, color: 'text-zinc-900 dark:text-white', bg: 'bg-zinc-50 dark:bg-zinc-800/50', border: 'border-zinc-200 dark:border-zinc-700' },
  { key: 'twitter', name: 'Twitter / X', icon: MessageSquare, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-800' },
];

export default function PlatformSelector({ connectedPlatforms, selected, onChange }) {
  const selectedSet = new Set(selected);

  const toggle = (key) => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Select Platforms</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const isConnected = connectedPlatforms.includes(platform.key);
          const isSelected = selectedSet.has(platform.key);

          return (
            <button
              key={platform.key}
              type="button"
              disabled={!isConnected}
              onClick={() => isConnected && toggle(platform.key)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                !isConnected
                  ? 'opacity-40 cursor-not-allowed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  : isSelected
                  ? `${platform.bg} ${platform.border} ${platform.color}`
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{platform.name}</p>
                {!isConnected && (
                  <p className="text-xs text-zinc-500">Not connected</p>
                )}
              </div>
              {isSelected && isConnected && (
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected.includes('youtube') && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>YouTube: Approx. 6 video uploads/day via the API (10,000 daily quota).</p>
        </div>
      )}
      {selected.includes('tiktok') && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>TikTok: Posts will be private until your TikTok app passes audit review.</p>
        </div>
      )}
      {selected.includes('twitter') && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Twitter: Video uploads require an additional media upload step and may take a moment.</p>
        </div>
      )}
    </div>
  );
}
