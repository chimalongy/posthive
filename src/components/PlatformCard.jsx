'use client';

import { useState } from 'react';
import { Check, Link2, Unlink, Globe, Camera, Play, Music2, MessageSquare, RefreshCw } from 'lucide-react';

const platformMeta = {
  facebook: {
    name: 'Facebook',
    icon: Globe,
    color: 'bg-blue-600',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  instagram: {
    name: 'Instagram',
    icon: Camera,
    color: 'bg-pink-600',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200 dark:border-pink-800',
  },
  youtube: {
    name: 'YouTube',
    icon: Play,
    color: 'bg-red-600',
    textColor: 'text-red-600',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  tiktok: {
    name: 'TikTok',
    icon: Music2,
    color: 'bg-black dark:bg-white',
    textColor: 'text-black dark:text-white',
    borderColor: 'border-zinc-200 dark:border-zinc-700',
  },
  twitter: {
    name: 'Twitter / X',
    icon: MessageSquare,
    color: 'bg-sky-500',
    textColor: 'text-sky-500',
    borderColor: 'border-sky-200 dark:border-sky-800',
  },
};

export default function PlatformCard({ platform, connected, details, onConnect, onDisconnect, onReconnect }) {
  const meta = platformMeta[platform];
  const Icon = meta.icon;

  return (
    <div className={`rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border ${meta.borderColor} p-6 flex flex-col gap-4`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${meta.color} text-white flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{meta.name}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {connected ? 'Connected and ready to post' : 'Not connected'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {connected ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm font-medium border border-green-200 dark:border-green-800">
                <Check className="w-3.5 h-3.5" />
                Connected
              </span>
              {platform === 'tiktok' && details?.credentials?.isSandbox && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                  Sandbox
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={onDisconnect}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
              {(platform === 'youtube' || platform === 'tiktok') && (
                <button
                  onClick={onReconnect}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reconnect
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
