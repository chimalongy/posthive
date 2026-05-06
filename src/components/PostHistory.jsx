'use client';

import { useState } from 'react';
import { Image, Video, FileText, CheckCircle, XCircle, AlertCircle, ChevronRight, X } from 'lucide-react';

export default function PostHistory({ posts, mediaMap }) {
  const [selectedPost, setSelectedPost] = useState(null);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'posted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-medium border border-green-200 dark:border-green-800">
            <CheckCircle className="w-3.5 h-3.5" />
            Posted
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs font-medium border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="w-3.5 h-3.5" />
            Partial
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-medium border border-red-200 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium border border-zinc-200 dark:border-zinc-700">
            <AlertCircle className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  const platformColors = {
    facebook: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    instagram: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
    youtube: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    tiktok: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    twitter: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  };

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const media = mediaMap?.[post.media_id];
        const isVideo = media?.file_type?.startsWith('video/');

        return (
          <div
            key={post.id}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
              {media?.public_url && !isVideo ? (
                <img src={media.public_url} alt="" className="w-full h-full object-cover" />
              ) : (
                isVideo ? <Video className="w-5 h-5 text-zinc-500" /> : <Image className="w-5 h-5 text-zinc-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {post.caption?.slice(0, 80)}{post.caption?.length > 80 ? '...' : ''}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {post.platforms?.map((platform) => (
                  <span
                    key={platform}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border ${platformColors[platform] || ''}`}
                  >
                    {platform}
                  </span>
                ))}
                <span className="text-xs text-zinc-400">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {getStatusBadge(post.status)}
              <button
                onClick={() => setSelectedPost(post)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>
        );
      })}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Post Details</h3>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase">Caption</label>
                <p className="text-sm mt-1">{selectedPost.caption}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase">Platforms</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedPost.platforms?.map((platform) => (
                    <span
                      key={platform}
                      className={`px-2 py-1 rounded-md text-xs font-medium border ${platformColors[platform] || ''}`}
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase">Results</label>
                <div className="mt-2 space-y-2">
                  {selectedPost.results && Object.entries(selectedPost.results).map(([platform, result]) => (
                    <div
                      key={platform}
                      className={`p-3 rounded-xl border ${
                        result.success
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-sm font-medium capitalize">{platform}</span>
                      </div>
                      {result.postId && (
                        <p className="text-xs text-zinc-500 mt-1">Post ID: {result.postId}</p>
                      )}
                      {result.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase">Date</label>
                <p className="text-sm mt-1">{new Date(selectedPost.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
