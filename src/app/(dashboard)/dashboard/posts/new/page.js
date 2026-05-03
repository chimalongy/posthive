'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PlatformSelector from '@/components/PlatformSelector';
import { createClient } from '@/lib/supabaseBrowser';
import { Loader2, Image, Video, ArrowLeft, Send } from 'lucide-react';

import { Suspense } from 'react';

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <NewPostContent />
    </Suspense>
  );
}

function NewPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [media, setMedia] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState(searchParams.get('mediaId') || '');
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [mediaRes, platformsRes] = await Promise.all([
      supabase.from('media_uploads').select('*').order('created_at', { ascending: false }).limit(20),
      fetch('/api/platforms').then((r) => r.json()).catch(() => ({ platforms: [] })),
    ]);

    if (mediaRes.data) setMedia(mediaRes.data);
    if (platformsRes.platforms) {
      setConnectedPlatforms(platformsRes.platforms.map((p) => p.platform));
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedMediaId) {
      setError('Please select a media item.');
      return;
    }
    if (!caption.trim()) {
      setError('Please enter a caption.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_id: selectedMediaId,
          caption: caption.trim(),
          platforms: selectedPlatforms,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create post');

      setResults(data.results);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const selectedMedia = media.find((m) => m.id === selectedMediaId);
  const isVideo = selectedMedia?.file_type?.startsWith('video/');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/posts')}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Create Post</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Compose and publish to your connected platforms.</p>
        </div>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Media</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {media.map((item) => {
                const isVid = item.file_type?.startsWith('video/');
                const isSelected = item.id === selectedMediaId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMediaId(item.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      isSelected ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                    }`}
                  >
                    {item.public_url && !isVid ? (
                      <img src={item.public_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        {isVid ? <Video className="w-6 h-6 text-zinc-400" /> : <Image className="w-6 h-6 text-zinc-400" />}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedMedia && (
              <div className="mt-4 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 max-h-64">
                {isVideo ? (
                  <video src={selectedMedia.public_url} controls className="w-full max-h-64 object-contain" />
                ) : (
                  <img src={selectedMedia.public_url} alt="Selected" className="w-full max-h-64 object-contain" />
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Write your caption here..."
            />
          </div>

          <PlatformSelector
            connectedPlatforms={connectedPlatforms}
            selected={selectedPlatforms}
            onChange={setSelectedPlatforms}
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Send className="w-4 h-4" />
            {loading ? 'Posting...' : 'Post Now'}
          </button>
        </form>
      )}

      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Post Results</h3>
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.platform}
                  className={`p-3 rounded-xl border ${
                    result.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="text-sm font-medium capitalize">{result.platform}</span>
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
            <button
              onClick={() => {
                setResults(null);
                router.push('/posts');
              }}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-medium text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
